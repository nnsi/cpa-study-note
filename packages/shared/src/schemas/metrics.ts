import { z } from "zod"

// 日付フォーマット（YYYY-MM-DD）
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")

// オンザフライ集計の日次メトリクス（スナップショットテーブル不使用）
export const dailyMetricSchema = z.object({
  date: dateStringSchema,
  checkedTopicCount: z.number().int().min(0),
  sessionCount: z.number().int().min(0),
  messageCount: z.number().int().min(0),
  goodQuestionCount: z.number().int().min(0),
})

export type DailyMetric = z.infer<typeof dailyMetricSchema>

// 後方互換のためのスナップショットスキーマ（廃止予定）
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

// Response schemas（オンザフライ集計版）
export const dailyMetricsResponseSchema = z.array(dailyMetricSchema)

export type DailyMetricsResponse = z.infer<typeof dailyMetricsResponseSchema>
