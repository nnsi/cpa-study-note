import type { AIAdapter, AIMessage, StreamChunk, AIConfig } from "@/shared/lib/ai"
import type { Logger } from "@/shared/lib/logger"
import type { Tracer } from "@/shared/lib/tracer"
import type { SubjectRepository } from "../subject/repository"
import type { StudyDomainRepository } from "../study-domain/repository"
import { sanitizeForPrompt, sanitizeCustomPrompt } from "../chat/domain/sanitize"

export type TopicGeneratorDeps = {
  subjectRepo: SubjectRepository
  studyDomainRepo: StudyDomainRepository
  aiAdapter: AIAdapter
  aiConfig: AIConfig
  logger: Logger
  tracer: Tracer
}

type SuggestTopicsInput = {
  subjectId: string
  userId: string
  prompt: string
}

const buildTopicGeneratorPrompt = (params: {
  studyDomainName: string
  subjectName: string
  existingCategories: string[]
}): string => {
  const safeDomainName = sanitizeForPrompt(params.studyDomainName)
  const safeSubjectName = sanitizeForPrompt(params.subjectName)
  const categoriesList =
    params.existingCategories.length > 0
      ? params.existingCategories.map(sanitizeForPrompt).join("、")
      : "（なし）"

  return `あなたは学習支援アプリの論点整理アシスタントです。
ユーザーが指定した学習テーマについて、カテゴリと論点の候補を提案してください。

## コンテキスト
- 学習領域: ${safeDomainName}
- 科目: ${safeSubjectName}
- 既存カテゴリ: ${categoriesList}

## ルール
- ユーザーの入力に基づいて、カテゴリと論点を提案する
- 既存カテゴリに追加すべき論点がある場合は、そのカテゴリ名を使う
- 各論点には簡潔な説明（1文）を付ける
- 提案数は5〜15個程度に収める
- 試験・資格の文脈に沿った粒度にする
- カテゴリは「単元」レベルの粒度（例: 課税要件、納税義務、税額計算）
- 論点は「個別の学習ポイント」レベル（例: 課税資産の譲渡等、非課税取引）

## 出力形式
まず提案内容について簡潔に説明し、最後に必ず以下のJSON形式で出力してください。
JSONの前に \`\`\`json 、後に \`\`\` を付けてください:

\`\`\`json
{
  "categories": [
    {
      "name": "カテゴリ名",
      "topics": [
        { "name": "論点名", "description": "簡潔な説明" }
      ]
    }
  ]
}
\`\`\``
}

export async function* suggestTopics(
  deps: TopicGeneratorDeps,
  input: SuggestTopicsInput
): AsyncIterable<StreamChunk> {
  const { tracer } = deps

  // 1. 科目の存在確認
  const subject = await tracer.span("d1.findSubject", () =>
    deps.subjectRepo.findById(input.subjectId, input.userId)
  )
  if (!subject) {
    yield { type: "error", error: "科目が見つかりません" }
    return
  }

  // 2. 既存カテゴリ一覧と学習領域情報を並列取得
  const [categoryRecords, studyDomain] = await tracer.span("d1.categoriesAndDomain", () =>
    Promise.all([
      deps.subjectRepo.findCategoriesBySubjectId(input.subjectId, input.userId),
      deps.studyDomainRepo.findById(subject.studyDomainId, input.userId),
    ])
  )

  const existingCategoryNames = categoryRecords.map((c) => c.name)

  // 3. AIプロンプト構築
  const systemPrompt = buildTopicGeneratorPrompt({
    studyDomainName: studyDomain?.name ?? "",
    subjectName: subject.name,
    existingCategories: existingCategoryNames,
  })

  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: sanitizeCustomPrompt(input.prompt) },
  ]

  // 4. AIストリーミング（text/done/errorのみyield、フロントエンドがJSONパースを担当）
  const aiStart = performance.now()
  try {
    for await (const chunk of deps.aiAdapter.streamText({
      model: deps.aiConfig.topicGenerator.model,
      messages,
      temperature: deps.aiConfig.topicGenerator.temperature,
      maxTokens: deps.aiConfig.topicGenerator.maxTokens,
    })) {
      if (chunk.type === "text" && chunk.content) {
        yield chunk
      }
    }
  } catch (error) {
    deps.logger.error("Stream error", { error: error instanceof Error ? error.message : String(error) })
    yield { type: "error", error: "AI応答中にエラーが発生しました。再度お試しください。" }
    return
  }

  tracer.addSpan("ai.stream", performance.now() - aiStart)
  deps.logger.info("Stream complete", tracer.getSummary())
  yield { type: "done" }
}
