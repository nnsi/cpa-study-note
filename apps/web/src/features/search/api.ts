import { api } from "@/lib/api-client"
import type { TopicSearchResult } from "@cpa-study/shared/schemas"
import { searchTopicsResponseSchema } from "@cpa-study/shared/schemas"

export type { TopicSearchResult }

export const searchTopics = async (
  query: string,
  studyDomainId?: string,
  limit: number = 10
): Promise<{ results: TopicSearchResult[]; total: number }> => {
  const res = await api.api.view.search.$get({
    query: { q: query, limit: String(limit), studyDomainId },
  })
  if (!res.ok) throw new Error("検索に失敗しました")
  const json = await res.json()
  const data = searchTopicsResponseSchema.parse(json)
  // Transform to TopicSearchResult format (topic.ts schema has extra fields)
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
