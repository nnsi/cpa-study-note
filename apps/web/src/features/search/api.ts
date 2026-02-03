import { api } from "@/lib/api-client"
import type { TopicSearchResult } from "@cpa-study/shared/schemas"

export type { TopicSearchResult }

type ViewSearchResponse = {
  results: Array<{
    id: string
    name: string
    subjectId: string
    subjectName: string
    categoryId: string
    categoryName: string
  }>
  total: number
}

export const searchTopics = async (
  query: string,
  studyDomainId?: string,
  limit: number = 10
): Promise<{ results: TopicSearchResult[]; total: number }> => {
  const res = await api.api.view.search.$get({
    query: { q: query, limit: String(limit), studyDomainId },
  })
  if (!res.ok) throw new Error("Failed to search topics")
  const data = (await res.json()) as ViewSearchResponse
  // Transform to TopicSearchResult format
  return {
    results: data.results.map((r) => ({
      id: r.id,
      name: r.name,
      description: null,
      studyDomainId: studyDomainId ?? "",
      subjectId: r.subjectId,
      categoryId: r.categoryId,
      subjectName: r.subjectName,
      categoryName: r.categoryName,
    })),
    total: data.total,
  }
}
