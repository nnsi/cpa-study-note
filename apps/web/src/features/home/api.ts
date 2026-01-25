import { api } from "@/lib/api-client"

export type TodayMetrics = {
  sessionCount: number
  messageCount: number
  checkedTopicCount: number
}

export type RecentTopic = {
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
  categoryId: string
  lastAccessedAt: string
}

export const getTodayMetrics = async (): Promise<{ metrics: TodayMetrics }> => {
  const res = await api.api.metrics.today.$get()
  if (!res.ok) throw new Error("Failed to fetch today metrics")
  return res.json()
}

export const getRecentTopics = async (): Promise<{ topics: RecentTopic[] }> => {
  const res = await api.api.subjects.progress.recent.$get()
  if (!res.ok) throw new Error("Failed to fetch recent topics")
  return res.json()
}
