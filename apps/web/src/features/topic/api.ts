import { api } from "@/lib/api-client"

export type CheckHistoryItem = {
  id: string
  action: "checked" | "unchecked"
  checkedAt: string
}

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
