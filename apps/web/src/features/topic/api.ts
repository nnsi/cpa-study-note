import { api } from "@/lib/api-client"
import type { TopicCheckHistoryResponse } from "@cpa-study/shared"

export type CheckHistoryItem = TopicCheckHistoryResponse

export const getCheckHistory = async (
  subjectId: string,
  topicId: string
): Promise<{ history: CheckHistoryItem[] }> => {
  const res = await api.api.subjects[":subjectId"].topics[":topicId"][
    "check-history"
  ].$get({
    param: { subjectId, topicId },
  })
  if (!res.ok) throw new Error("Failed to fetch check history")
  return res.json()
}
