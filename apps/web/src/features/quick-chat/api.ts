import { api } from "@/lib/api-client"
import {
  quickChatSuggestResponseSchema,
  type QuickChatSuggestResponse,
} from "@cpa-study/shared/schemas"

export const suggestTopics = async (
  domainId: string,
  question: string
): Promise<QuickChatSuggestResponse> => {
  const res = await api.api["quick-chat"].suggest.$post({
    json: { domainId, question },
  })
  if (!res.ok) throw new Error("論点サジェストに失敗しました")
  const data = await res.json()
  return quickChatSuggestResponseSchema.parse(data)
}
