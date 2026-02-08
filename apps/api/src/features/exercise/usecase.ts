import type { ExerciseRepository } from "./repository"
import type { ImageRepository } from "../image/repository"
import type { AIAdapter, AIConfig } from "@/shared/lib/ai"
import type {
  AnalyzeExerciseResponse,
  ConfirmExerciseResponse,
  TopicExercisesResponse,
  SuggestedTopic,
  Confidence,
} from "@cpa-study/shared/schemas"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, forbidden, badRequest, type AppError } from "@/shared/lib/errors"
import { sanitizeFilename, validateMagicBytes } from "../image/usecase"

type ExerciseDeps = {
  exerciseRepo: ExerciseRepository
  imageRepo: ImageRepository
  aiAdapter: AIAdapter
  aiConfig: AIConfig
  r2: R2Bucket
}

// ArrayBufferをBase64に変換（チャンク処理でスタックオーバーフロー防止）
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000 // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

// 論点推測AIレスポンスをパース
const parseTopicSuggestions = (
  aiResponse: string,
  topicMap: Map<string, { name: string; subjectName: string }>
): SuggestedTopic[] => {
  try {
    // コードブロックを除去
    let jsonStr = aiResponse
    const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr)
    const suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions || []

    return suggestions
      .slice(0, 3) // 最大3件
      .map((s: { topicId?: string; confidence?: string; reason?: string }) => {
        if (!s.topicId) return null
        const topic = topicMap.get(s.topicId)
        if (!topic) return null

        const confidence = (["high", "medium", "low"].includes(s.confidence || "")
          ? s.confidence
          : "low") as Confidence

        return {
          topicId: s.topicId,
          topicName: topic.name,
          subjectName: topic.subjectName,
          confidence,
          reason: s.reason || "AIによる推測",
        }
      })
      .filter((s: SuggestedTopic | null): s is SuggestedTopic => s !== null)
  } catch {
    return []
  }
}

// 画像分析（アップロード + OCR + 論点推測）
export const analyzeExercise = async (
  deps: ExerciseDeps,
  userId: string,
  filename: string,
  mimeType: string,
  imageData: ArrayBuffer
): Promise<Result<AnalyzeExerciseResponse, AppError>> => {
  const { exerciseRepo, imageRepo, aiAdapter, aiConfig, r2 } = deps

  // 1. マジックバイト検証
  if (!validateMagicBytes(imageData, mimeType)) {
    return err(badRequest("ファイル形式が不正です"))
  }

  // 2. 画像をR2に保存
  const imageId = crypto.randomUUID()
  const safeFilename = sanitizeFilename(filename)
  const r2Key = `images/${imageId}/${safeFilename}`

  await imageRepo.create({
    id: imageId,
    userId,
    filename,
    mimeType,
    size: imageData.byteLength,
    r2Key,
    ocrText: null,
  })

  await r2.put(r2Key, imageData, {
    httpMetadata: {
      contentType: mimeType,
    },
  })

  // 3. OCR実行
  const base64 = arrayBufferToBase64(imageData)
  const imageUrl = `data:${mimeType};base64,${base64}`

  const ocrPrompt = `この画像から全てのテキストを抽出してください。
表や数式がある場合は、構造を保持してテキスト形式で出力してください。
数値や計算式は正確に抽出してください。`

  const ocrResult = await aiAdapter.generateText({
    model: aiConfig.ocr.model,
    messages: [
      {
        role: "user",
        content: ocrPrompt,
        imageUrl,
      },
    ],
    temperature: aiConfig.ocr.temperature,
    maxTokens: aiConfig.ocr.maxTokens,
  })

  const ocrText = ocrResult.content
  await imageRepo.updateOcrText(imageId, ocrText)

  // 4. 論点リストを取得
  const topicsForSuggestion = await exerciseRepo.findTopicsForSuggestion(userId)
  const topicMap = new Map(
    topicsForSuggestion.map((t) => [t.id, { name: t.name, subjectName: t.subjectName }])
  )

  // 5. 論点推測AI呼び出し
  const topicListText = topicsForSuggestion
    .map((t) => `- ${t.id}: ${t.name} (${t.subjectName})`)
    .join("\n")

  const suggestionPrompt = `あなたは公認会計士試験の論点分類アシスタントです。

以下の問題文を読み、最も関連する論点を1〜3件推測してください。

## 問題文
${ocrText}

## 論点リスト
${topicListText}

## 出力形式
JSON形式で出力してください:
[
  {
    "topicId": "論点ID",
    "confidence": "high" | "medium" | "low",
    "reason": "推測の根拠（30字以内）"
  }
]

推測に自信がない場合は正直に low と出力してください。
論点リストにない論点は出力しないでください。`

  let suggestedTopics: SuggestedTopic[] = []
  try {
    const suggestionResult = await aiAdapter.generateText({
      model: aiConfig.chat.model,
      messages: [
        {
          role: "user",
          content: suggestionPrompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    })

    suggestedTopics = parseTopicSuggestions(suggestionResult.content, topicMap)
  } catch {
    // 論点推測に失敗しても処理は続行
  }

  // 6. Exercise作成
  const exerciseId = crypto.randomUUID()
  await exerciseRepo.create({
    id: exerciseId,
    userId,
    imageId,
    suggestedTopicIds: suggestedTopics.map((s) => s.topicId),
  })

  return ok({
    exerciseId,
    imageId,
    ocrText,
    suggestedTopics,
  })
}

// 論点確定
export const confirmExercise = async (
  deps: Pick<ExerciseDeps, "exerciseRepo">,
  userId: string,
  exerciseId: string,
  topicId: string,
  markAsUnderstood: boolean
): Promise<Result<ConfirmExerciseResponse, AppError>> => {
  const { exerciseRepo } = deps

  const exercise = await exerciseRepo.findByIdWithOwnerCheck(exerciseId, userId)
  if (!exercise) {
    return err(notFound("問題が見つかりません"))
  }

  if (exercise.confirmedAt) {
    return err(badRequest("この問題は既に確定されています"))
  }

  const updated = await exerciseRepo.confirm(exerciseId, topicId, markAsUnderstood)
  if (!updated) {
    return err(badRequest("指定された論点が存在しないか、問題の更新に失敗しました"))
  }

  return ok({
    exerciseId: updated.id,
    topicId,
    topicChecked: markAsUnderstood,
    createdAt: updated.createdAt.toISOString(),
  })
}

// 論点に紐づく問題一覧取得
export const getTopicExercises = async (
  deps: Pick<ExerciseDeps, "exerciseRepo">,
  userId: string,
  topicId: string
): Promise<Result<TopicExercisesResponse, AppError>> => {
  const { exerciseRepo } = deps

  const exercises = await exerciseRepo.findByTopicId(topicId, userId)

  return ok({
    exercises: exercises.map((e) => ({
      exerciseId: e.exerciseId,
      imageId: e.imageId,
      ocrText: e.ocrText,
      createdAt: e.createdAt.toISOString(),
      markedAsUnderstood: e.markedAsUnderstood,
    })),
  })
}
