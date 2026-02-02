import { z } from "zod"
import { api } from "@/lib/api-client"
import { dailyMetricSchema, type DailyMetric } from "@cpa-study/shared/schemas"

export type { DailyMetric }

// APIレスポンスは { metrics: DailyMetric[] } の形式
const dailyMetricsApiResponseSchema = z.object({
  metrics: z.array(dailyMetricSchema),
})

export type DailyMetricsResponse = z.infer<typeof dailyMetricsApiResponseSchema>

export const getDailyMetrics = async (
  from: string,
  to: string
): Promise<DailyMetricsResponse> => {
  const res = await api.api.metrics.daily.$get({
    query: { from, to },
  })
  if (!res.ok) throw new Error("Failed to fetch daily metrics")
  const data = await res.json()
  return dailyMetricsApiResponseSchema.parse(data)
}
