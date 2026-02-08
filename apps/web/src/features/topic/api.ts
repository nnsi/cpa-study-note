import { api } from "@/lib/api-client"
import {
  checkHistoryListResponseSchema,
  type TopicCheckHistoryResponse,
  type CheckHistoryListResponse,
} from "@cpa-study/shared/schemas"

export type CheckHistoryItem = TopicCheckHistoryResponse

export const getCheckHistory = async (
  _subjectId: string,
  topicId: string
): Promise<CheckHistoryListResponse> => {
  // Note: subjectId is no longer needed for the Learning API
  const res = await api.api.learning.topics[":topicId"]["check-history"].$get({
    param: { topicId },
  })
  if (!res.ok) throw new Error("チェック履歴の取得に失敗しました")
  const json = await res.json()
  return checkHistoryListResponseSchema.parse(json)
}
