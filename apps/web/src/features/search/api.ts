import { api } from "@/lib/api-client"
import type { TopicSearchResult } from "@cpa-study/shared/schemas"

export type { TopicSearchResult }

export const searchTopics = async (
  query: string,
  studyDomainId?: string,
  limit: number = 10
): Promise<{ results: TopicSearchResult[]; total: number }> => {
  const res = await api.api.subjects.search.$get({
    query: { q: query, limit: String(limit), studyDomainId },
  })
  if (!res.ok) throw new Error("Failed to search topics")
  return res.json()
}
