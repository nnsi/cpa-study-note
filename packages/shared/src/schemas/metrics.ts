import { z } from "zod"

// 日付フォーマット（YYYY-MM-DD）
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")

export const metricSnapshotSchema = z.object({
  id: z.string(),
  date: dateStringSchema,
  userId: z.string(),
  checkedTopicCount: z.number().int().min(0),
  sessionCount: z.number().int().min(0),
  messageCount: z.number().int().min(0),
  goodQuestionCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
})

export type MetricSnapshot = z.infer<typeof metricSnapshotSchema>

// Request schemas
export const getDailyMetricsRequestSchema = z.object({
  from: dateStringSchema,
  to: dateStringSchema,
})

export type GetDailyMetricsRequest = z.infer<typeof getDailyMetricsRequestSchema>

// Response schemas
export const dailyMetricsResponseSchema = z.array(metricSnapshotSchema)

export type DailyMetricsResponse = z.infer<typeof dailyMetricsResponseSchema>
