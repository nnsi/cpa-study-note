import { api } from "@/lib/api-client"

// オンザフライ集計の日次メトリクス
export type DailyMetric = {
  date: string
  checkedTopicCount: number
  sessionCount: number
  messageCount: number
  goodQuestionCount: number
}

export type DailyMetricsResponse = {
  metrics: DailyMetric[]
}

export const getDailyMetrics = async (
  from: string,
  to: string
): Promise<DailyMetricsResponse> => {
  const res = await api.api.metrics.daily.$get({
    query: { from, to },
  })
  if (!res.ok) throw new Error("Failed to fetch daily metrics")
  return res.json()
}
