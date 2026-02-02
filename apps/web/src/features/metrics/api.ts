import { api } from "@/lib/api-client"
import {
  dailyMetricsWrapperResponseSchema,
  type DailyMetric,
  type DailyMetricsWrapperResponse,
} from "@cpa-study/shared/schemas"

export type { DailyMetric }

export type DailyMetricsResponse = DailyMetricsWrapperResponse

export const getDailyMetrics = async (
  from: string,
  to: string
): Promise<DailyMetricsResponse> => {
  const res = await api.api.metrics.daily.$get({
    query: { from, to },
  })
  if (!res.ok) throw new Error("Failed to fetch daily metrics")
  const data = await res.json()
  return dailyMetricsWrapperResponseSchema.parse(data)
}
