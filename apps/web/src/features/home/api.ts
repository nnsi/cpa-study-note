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
  if (!res.ok) throw new Error("今日の学習指標の取得に失敗しました")
  const data = await res.json()
  return todayMetricsResponseSchema.parse(data)
}

export const getRecentTopics = async () => {
  const res = await api.api.learning.topics.recent.$get({ query: {} })
  if (!res.ok) throw new Error("最近の論点の取得に失敗しました")
  const data = await res.json()
  return recentTopicsResponseSchema.parse(data)
}
