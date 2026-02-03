import { api } from "@/lib/api-client"
import type { TopicCheckHistoryResponse } from "@cpa-study/shared"

export type CheckHistoryItem = TopicCheckHistoryResponse

export const getCheckHistory = async (
  _subjectId: string,
  topicId: string
): Promise<{ history: CheckHistoryItem[] }> => {
  // Note: subjectId is no longer needed for the Learning API
  const res = await api.api.learning.topics[":topicId"]["check-history"].$get({
    param: { topicId },
  })
  if (!res.ok) throw new Error("Failed to fetch check history")
  return res.json() as Promise<{ history: CheckHistoryItem[] }>
}
