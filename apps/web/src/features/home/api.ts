import { api } from "@/lib/api-client"
import {
  type TodayMetrics,
  type RecentTopic,
  todayMetricsResponseSchema,
  recentTopicsResponseSchema,
} from "@cpa-study/shared"

export type { TodayMetrics, RecentTopic }

export const getTodayMetrics = async () => {
  const res = await api.api.metrics.today.$get()
  if (!res.ok) throw new Error("Failed to fetch today metrics")
  const data = await res.json()
  return todayMetricsResponseSchema.parse(data)
}

export const getRecentTopics = async () => {
  const res = await api.api.learning.topics.recent.$get({ query: {} })
  if (!res.ok) throw new Error("Failed to fetch recent topics")
  const data = await res.json()
  return recentTopicsResponseSchema.parse(data)
}
