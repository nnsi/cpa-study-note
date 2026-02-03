import { api } from "@/lib/api-client"
import type { FilteredTopic, TopicFilterParams } from "@cpa-study/shared"

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

  const res = await api.api.view.topics.$get({ query })
  if (!res.ok) throw new Error("Failed to filter topics")
  type ViewTopicsResponse = {
    topics: Array<{
      id: string
      name: string
      subjectId: string
      subjectName: string
      categoryId: string
      understood: boolean
      lastAccessedAt: string | null
      sessionCount: number
    }>
    total: number
  }
  const data = (await res.json()) as ViewTopicsResponse
  // Transform view API response to FilteredTopic format
  return data.topics.map((t) => ({
    id: t.id,
    name: t.name,
    subjectId: t.subjectId,
    subjectName: t.subjectName,
    categoryId: t.categoryId,
    understood: t.understood,
    lastChatAt: t.lastAccessedAt, // Map lastAccessedAt to lastChatAt for compatibility
    sessionCount: t.sessionCount,
    // View API doesn't return this field, default to 0
    goodQuestionCount: 0,
  }))
}
