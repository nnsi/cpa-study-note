import { api } from "@/lib/api-client"
import type { FilteredTopic, TopicFilterParams } from "@cpa-study/shared"
import { reviewListResponseSchema } from "@cpa-study/shared/schemas"

export type { FilteredTopic, TopicFilterParams }

export const filterTopics = async (
  params: TopicFilterParams
): Promise<FilteredTopic[]> => {
  const query: Record<string, string> = {}

  // View API uses different parameter names
  if (params.understood !== undefined) {
    query.understood = String(params.understood)
  }
  if (params.daysSinceLastChat !== undefined) {
    query.daysSince = String(params.daysSinceLastChat)
  }
  if (params.minSessionCount !== undefined) {
    query.minSessionCount = String(params.minSessionCount)
  }
  if (params.minGoodQuestionCount !== undefined) {
    query.minGoodQuestionCount = String(params.minGoodQuestionCount)
  }

  const res = await api.api.view.topics.$get({ query })
  if (!res.ok) throw new Error("論点のフィルタに失敗しました")
  const json = await res.json()
  const data = reviewListResponseSchema.parse(json)
  // Transform view API response to FilteredTopic format
  return data.topics.map((t) => ({
    id: t.id,
    name: t.name,
    studyDomainId: t.studyDomainId,
    subjectId: t.subjectId,
    subjectName: t.subjectName,
    categoryId: t.categoryId,
    understood: t.understood,
    lastChatAt: t.lastChatAt,
    sessionCount: t.sessionCount,
    goodQuestionCount: t.goodQuestionCount,
  }))
}
