import type { AIAdapter, AIConfig } from "@/shared/lib/ai"
import type { QuickChatRepository, TopicForSuggest } from "./repository"
import type { QuickChatSuggestion } from "@cpa-study/shared/schemas"
import { parseLLMJson } from "@cpa-study/shared"
import { z } from "zod"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, type AppError } from "@/shared/lib/errors"
import { sanitizeCustomPrompt } from "../chat/domain/sanitize"

export type QuickChatDeps = {
  quickChatRepo: QuickChatRepository
  aiAdapter: AIAdapter
  aiConfig: AIConfig
}

type SuggestInput = {
  domainId: string
  userId: string
  question: string
}

const buildTopicList = (topics: TopicForSuggest[]): string => {
  if (topics.length === 0) return "（論点なし）"

  return topics
    .map(
      (t) =>
        `${t.subjectName} / ${t.categoryName} / ${t.topicName} [${t.topicId}]`
    )
    .join("\n")
}

const buildPrompt = (question: string, topicList: string): string => {
  return `あなたは学習論点の分類アシスタントです。

ユーザーの質問に最も関連する論点を、既存の論点リストから1〜3件選んでください。
適切な既存論点がない場合は、新規論点の作成を提案してください。

## ユーザーの質問
${question}

## 既存の論点リスト
${topicList}
（形式: subjectName / categoryName / topicName [topicId]）

## 出力形式（JSON）
{
  "suggestions": [
    {
      "type": "existing" | "new",
      "topicId": "既存の場合はID、新規はnull",
      "topicName": "論点名",
      "categoryName": "カテゴリ名",
      "categoryId": "既存カテゴリに配置する場合はID、新規カテゴリはnull",
      "subjectId": "科目ID",
      "subjectName": "科目名",
      "confidence": "high" | "medium" | "low",
      "reason": "選定理由（30字以内）"
    }
  ]
}

## ルール
- 既存論点で十分マッチするなら新規提案は不要
- confidence が low の既存論点より、新規提案の方が適切ならそちらを優先
- 科目・カテゴリが判別できない質問には confidence: "low" を付与
- 出力はJSON のみ。説明文は不要`
}

const suggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      type: z.enum(["existing", "new"]),
      topicId: z.string().nullable().default(null),
      topicName: z.string().default(""),
      categoryName: z.string().default(""),
      categoryId: z.string().nullable().default(null),
      subjectId: z.string().nullable().default(null),
      subjectName: z.string().default(""),
      confidence: z.enum(["high", "medium", "low"]).default("low"),
      reason: z.string().default(""),
    })
  ),
})

export const suggestTopicsForChat = async (
  deps: QuickChatDeps,
  input: SuggestInput
): Promise<Result<{ suggestions: QuickChatSuggestion[] }, AppError>> => {
  // 1. ドメイン内の全論点を取得
  const allTopics = await deps.quickChatRepo.findAllTopicsByDomain(
    input.domainId,
    input.userId
  )

  // 論点が0件でもAIに新規提案させるため続行

  // 2. トピックリスト構築
  const topicList = buildTopicList(allTopics)

  // 3. AIにサジェストを依頼
  const sanitizedQuestion = sanitizeCustomPrompt(input.question)
  const prompt = buildPrompt(sanitizedQuestion, topicList)

  let aiResponse: string
  try {
    const result = await deps.aiAdapter.generateText({
      model: deps.aiConfig.quickChatSuggest.model,
      messages: [{ role: "user", content: prompt }],
      temperature: deps.aiConfig.quickChatSuggest.temperature,
      maxTokens: deps.aiConfig.quickChatSuggest.maxTokens,
    })
    aiResponse = result.content
  } catch (error) {
    console.error("[quick-chat] AI error:", error)
    return err(notFound("AI応答の取得に失敗しました"))
  }

  // 4. AIレスポンスをパース
  const fallback = { suggestions: [] }
  const parsed = parseLLMJson(aiResponse, suggestionsSchema, fallback)

  // 5. ルックアップマップ構築
  const topicMap = new Map(allTopics.map((t) => [t.topicId, t]))
  const subjectNameToId = new Map<string, string>()
  const categoryLookup = new Map<string, string>() // key: `${subjectId}:${categoryName}`
  for (const t of allTopics) {
    subjectNameToId.set(t.subjectName, t.subjectId)
    categoryLookup.set(`${t.subjectId}:${t.categoryName}`, t.categoryId)
  }

  // 6. サジェストを検証・エンリッチ
  const validSuggestions: QuickChatSuggestion[] = []

  for (const suggestion of parsed.suggestions) {
    if (suggestion.type === "existing") {
      const topic = suggestion.topicId ? topicMap.get(suggestion.topicId) : null
      if (topic) {
        // DB情報で上書きして正確性を保証
        validSuggestions.push({
          ...suggestion,
          topicName: topic.topicName,
          categoryName: topic.categoryName,
          categoryId: topic.categoryId,
          subjectId: topic.subjectId,
          subjectName: topic.subjectName,
        })
      }
      // topicIdが不正な場合はスキップ
    } else {
      // new タイプ: 名前からsubjectId/categoryIdを解決
      const resolvedSubjectId = subjectNameToId.get(suggestion.subjectName)
      if (!resolvedSubjectId) continue // 科目が見つからない場合はスキップ

      const resolvedCategoryId =
        categoryLookup.get(`${resolvedSubjectId}:${suggestion.categoryName}`) ?? null

      validSuggestions.push({
        ...suggestion,
        subjectId: resolvedSubjectId,
        categoryId: resolvedCategoryId,
      })
    }
  }

  return ok({ suggestions: validSuggestions.slice(0, 3) })
}
