import { api } from "@/lib/api-client"
import type {
  TodayMetrics,
  TodayMetricsResponse,
  RecentTopic,
  RecentTopicsResponse,
} from "@cpa-study/shared"

export type { TodayMetrics, RecentTopic }

export const getTodayMetrics = async (): Promise<TodayMetricsResponse> => {
  const res = await api.api.metrics.today.$get()
  if (!res.ok) throw new Error("Failed to fetch today metrics")
  return res.json()
}

export const getRecentTopics = async (): Promise<RecentTopicsResponse> => {
  const res = await api.api.subjects.progress.recent.$get()
  if (!res.ok) throw new Error("Failed to fetch recent topics")
  return res.json()
}
