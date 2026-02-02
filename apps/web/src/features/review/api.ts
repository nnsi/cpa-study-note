import { api } from "@/lib/api-client"
import type { FilteredTopic, TopicFilterParams } from "@cpa-study/shared"

export type { FilteredTopic, TopicFilterParams }

export const filterTopics = async (
  params: TopicFilterParams
): Promise<FilteredTopic[]> => {
  const query: Record<string, string> = {}

  if (params.minSessionCount !== undefined) {
    query.minSessionCount = String(params.minSessionCount)
  }
  if (params.daysSinceLastChat !== undefined) {
    query.daysSinceLastChat = String(params.daysSinceLastChat)
  }
  if (params.understood !== undefined) {
    query.understood = String(params.understood)
  }
  if (params.hasPostCheckChat !== undefined) {
    query.hasPostCheckChat = String(params.hasPostCheckChat)
  }
  if (params.minGoodQuestionCount !== undefined) {
    query.minGoodQuestionCount = String(params.minGoodQuestionCount)
  }

  const res = await api.api.subjects.filter.$get({ query })
  if (!res.ok) throw new Error("Failed to filter topics")
  const data = await res.json()
  return data.topics
}
