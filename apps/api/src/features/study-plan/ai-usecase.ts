import type { AIAdapter, AIMessage, StreamChunk, AIConfig } from "@/shared/lib/ai"
import type { StudyPlanRepository } from "./repository"
import type { SubjectRepository } from "../subject/repository"
import { sanitizeForPrompt, sanitizeCustomPrompt } from "../chat/domain/sanitize"

export type PlanAssistantDeps = {
  repo: StudyPlanRepository
  subjectRepo: SubjectRepository
  aiAdapter: AIAdapter
  aiConfig: AIConfig
}

type SuggestPlanItemsInput = {
  planId: string
  userId: string
  prompt: string
}

const buildPlanAssistantPrompt = (params: {
  planTitle: string
  planIntent: string | null
  planScope: string
  subjectName: string | null
  existingItems: string[]
}): string => {
  const safeTitle = sanitizeForPrompt(params.planTitle)
  const safeIntent = params.planIntent ? sanitizeForPrompt(params.planIntent) : "（なし）"
  const safeSubject = params.subjectName ? sanitizeForPrompt(params.subjectName) : "（指定なし）"
  const itemsList =
    params.existingItems.length > 0
      ? params.existingItems.map((i) => `- ${sanitizeForPrompt(i)}`).join("\n")
      : "（なし）"

  return `あなたは学習計画の整理を支援するアシスタントです。
ユーザーが立てた学習計画について、計画要素（何を学ぶか）の候補を提案してください。

## 重要な制約
- あなたは「提案」をするだけで、「指示」や「推奨」はしない
- 「最適」「効率的」「必ず」「〜すべき」といった断定的な表現を避ける
- 計画は仮説であり、達成を保証するものではない
- 進捗管理・完了判定・評価は行わない

## AIが提案できること
- 学習する論点の候補
- 論点間の依存関係の整理
- 抜け落ちやすい論点の列挙（網羅性の保証はしない）
- 学習順序の一般的なパターン

## 計画の情報
- 計画名: ${safeTitle}
- 意図・背景: ${safeIntent}
- 対象範囲: ${params.planScope}
- 紐づけ科目: ${safeSubject}
- 既存の計画要素:
${itemsList}

## 出力形式
まず提案内容について簡潔に説明し、最後に必ず以下のJSON形式で出力してください。
JSONの前に \`\`\`json 、後に \`\`\` を付けてください:

\`\`\`json
{
  "items": [
    {
      "description": "やろうと考えた内容",
      "rationale": "そう考えた理由",
      "topicName": "関連する論点名（あれば）"
    }
  ]
}
\`\`\``
}

export async function* suggestPlanItems(
  deps: PlanAssistantDeps,
  input: SuggestPlanItemsInput
): AsyncIterable<StreamChunk> {
  // 1. 計画の存在確認 + 所有権チェック
  const owned = await deps.repo.isPlanOwnedByUser(input.planId, input.userId)
  if (!owned) {
    yield { type: "error", error: "計画が見つかりません" }
    return
  }

  // 2. 計画情報と既存要素を取得
  const [plan, items] = await Promise.all([
    deps.repo.findPlanById(input.planId),
    deps.repo.findItemsByPlan(input.planId),
  ])

  if (!plan) {
    yield { type: "error", error: "計画が見つかりません" }
    return
  }

  // 3. プロンプト構築
  const systemPrompt = buildPlanAssistantPrompt({
    planTitle: plan.title,
    planIntent: plan.intent,
    planScope: plan.scope,
    subjectName: plan.subjectName,
    existingItems: items.map((i) => i.description),
  })

  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: sanitizeCustomPrompt(input.prompt) },
  ]

  // 4. AIストリーミング
  try {
    for await (const chunk of deps.aiAdapter.streamText({
      model: deps.aiConfig.planAssistant.model,
      messages,
      temperature: deps.aiConfig.planAssistant.temperature,
      maxTokens: deps.aiConfig.planAssistant.maxTokens,
    })) {
      if (chunk.type === "text" && chunk.content) {
        yield chunk
      }
    }
  } catch (error) {
    console.error("[plan-assistant] Stream error:", error)
    yield { type: "error", error: "AI応答中にエラーが発生しました。再度お試しください。" }
    return
  }

  yield { type: "done" }
}
