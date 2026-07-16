import type { AIAdapter, AIConfig, AIMessage, StreamChunk } from "@/shared/lib/ai"
import { arrayBufferToBase64 } from "@/shared/lib/binary"
import type { Logger } from "@/shared/lib/logger"
import { err, ok, type Result } from "@/shared/lib/result"
import type { Tracer } from "@/shared/lib/tracer"
import { sanitizeForPrompt } from "../chat/domain/sanitize"
import type { ImageRepository } from "../image/repository"
import type { SubjectRepository } from "../subject/repository"

export type TocImportDeps = {
  subjectRepo: Pick<SubjectRepository, "findById" | "findCategoriesBySubjectId">
  imageRepo: Pick<ImageRepository, "findById">
  aiAdapter: AIAdapter
  aiConfig: AIConfig
  r2: R2Bucket
  logger: Logger
  tracer: Tracer
}

type SuggestFromTocInput = {
  subjectId: string
  userId: string
  imageIds: string[]
}

const buildTocImportPrompt = (params: {
  subjectName: string
  existingCategories: string[]
}): string => {
  const markdownFence = "```"
  const safeSubjectName = sanitizeForPrompt(params.subjectName)
  const categoriesList =
    params.existingCategories.length > 0
      ? params.existingCategories.map(sanitizeForPrompt).join("、")
      : "（なし）"

  return `あなたは教科書の目次を学習アプリのデータ構造に変換するアシスタントです。
与えられる複数の画像は、1冊のテキストの目次（連続するページ）です。

## コンテキスト
- 科目: ${safeSubjectName}
- 既存カテゴリ: ${categoriesList}

## 変換ルール
- 章（第1章など）→ categories[].name、節（1-1など）→ subcategories[].name、項・小見出し → topics[].name
- 階層が2段しかない場合: 章をカテゴリとし、subcategories は同名を1つ作って項目を topics に入れる
- ページ番号・リーダー線（……123）・柱・ノンブルは全て除去する
- 「第1章」「1.2」等の番号プレフィックスは除去し、見出しテキストのみ残す
- 「はじめに」「索引」「付録」「凡例」など学習項目でないものは除外する
- ページをまたいで続く章は1つにまとめる。画像は与えられた順序がページ順である
- 目次の掲載順を維持する
- 既存カテゴリと同名の章はその名前をそのまま使う（表記ゆれを寄せる）

## 出力形式
説明文は不要。以下のJSONのみを ${markdownFence}json ${markdownFence} で囲んで出力:
{"categories":[{"name":"...","subcategories":[{"name":"...","topics":[{"name":"..."}]}]}]}`
}

const loadImageMessage = async (
  deps: Pick<TocImportDeps, "imageRepo" | "r2" | "tracer" | "logger">,
  params: { imageId: string; userId: string; index: number; total: number }
): Promise<Result<AIMessage, string>> => {
  const label = `画像 ${params.index}/${params.total}`

  try {
    const image = await deps.tracer.span("d1.findImage", () =>
      deps.imageRepo.findById(params.imageId)
    )
    if (!image) {
      return err(`${label}が見つかりません`)
    }
    if (image.userId !== params.userId) {
      return err(`${label}へのアクセス権限がありません`)
    }

    const object = await deps.tracer.span("r2.get", () => deps.r2.get(image.r2Key))
    if (!object) {
      return err(`${label}の画像ファイルが見つかりません`)
    }

    const base64 = arrayBufferToBase64(await object.arrayBuffer())
    return ok({
      role: "user",
      content: `目次画像 ${params.index}/${params.total}`,
      imageUrl: `data:${image.mimeType};base64,${base64}`,
    })
  } catch (error) {
    deps.logger.error("目次画像の読み込みに失敗しました", {
      imageId: params.imageId,
      error: error instanceof Error ? error.message : String(error),
    })
    return err(`${label}の読み込みに失敗しました`)
  }
}

export async function* suggestFromToc(
  deps: TocImportDeps,
  input: SuggestFromTocInput
): AsyncIterable<StreamChunk> {
  let subject: Awaited<ReturnType<TocImportDeps["subjectRepo"]["findById"]>>

  try {
    subject = await deps.tracer.span("d1.findSubject", () =>
      deps.subjectRepo.findById(input.subjectId, input.userId)
    )
  } catch (error) {
    deps.logger.error("科目の読み込みに失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    })
    yield { type: "error", error: "科目の読み込みに失敗しました" }
    return
  }

  if (!subject) {
    yield { type: "error", error: "科目が見つかりません" }
    return
  }

  let categoryRecords: Awaited<
    ReturnType<TocImportDeps["subjectRepo"]["findCategoriesBySubjectId"]>
  >
  try {
    categoryRecords = await deps.tracer.span("d1.findCategories", () =>
      deps.subjectRepo.findCategoriesBySubjectId(input.subjectId, input.userId)
    )
  } catch (error) {
    deps.logger.error("既存カテゴリの読み込みに失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    })
    yield { type: "error", error: "既存カテゴリの読み込みに失敗しました" }
    return
  }

  const messages: AIMessage[] = [
    {
      role: "system",
      content: buildTocImportPrompt({
        subjectName: subject.name,
        existingCategories: categoryRecords.map((category) => category.name),
      }),
    },
  ]

  for (const [index, imageId] of input.imageIds.entries()) {
    const result = await loadImageMessage(deps, {
      imageId,
      userId: input.userId,
      index: index + 1,
      total: input.imageIds.length,
    })
    if (!result.ok) {
      yield { type: "error", error: result.error }
      return
    }
    messages.push(result.value)
  }

  messages.push({
    role: "user",
    content: "以上の目次画像を、指定された形式のJSONに変換してください。",
  })

  const aiStart = performance.now()
  try {
    for await (const chunk of deps.aiAdapter.streamText({
      model: deps.aiConfig.tocImport.model,
      messages,
      temperature: deps.aiConfig.tocImport.temperature,
      maxTokens: deps.aiConfig.tocImport.maxTokens,
    })) {
      if (chunk.type === "text" && chunk.content) {
        yield { type: "text", content: chunk.content }
      } else if (chunk.type === "error") {
        yield {
          type: "error",
          error: chunk.error ?? "AI応答中にエラーが発生しました。再度お試しください。",
        }
        return
      }
    }
  } catch (error) {
    deps.logger.error("目次インポートのAIストリームでエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
    })
    yield {
      type: "error",
      error: "AI応答中にエラーが発生しました。再度お試しください。",
    }
    return
  }

  deps.tracer.addSpan("ai.stream", performance.now() - aiStart)
  deps.logger.info("目次インポートのストリームが完了しました", deps.tracer.getSummary())
  yield { type: "done" }
}
