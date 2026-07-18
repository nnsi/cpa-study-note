import { z } from "zod"

// 日付フォーマット（YYYY-MM-DD）
// 形式だけでなく実在する暦日かどうかも検証する（例: 2026-13-01 や 2026-02-30 は拒否）
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine(
    (value) => {
      const [year, month, day] = value.split("-").map(Number)
      const date = new Date(Date.UTC(year, month - 1, day))
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      )
    },
    "Date must be a valid calendar date"
  )

// Today Metrics（ホーム画面用）
export const todayMetricsSchema = z.object({
  sessionCount: z.number().int().min(0),
  messageCount: z.number().int().min(0),
  checkedTopicCount: z.number().int().min(0),
})

export type TodayMetrics = z.infer<typeof todayMetricsSchema>

export const todayMetricsResponseSchema = z.object({
  metrics: todayMetricsSchema,
})

export type TodayMetricsResponse = z.infer<typeof todayMetricsResponseSchema>

// Recent Topic（最近アクセスした論点）
export const recentTopicSchema = z.object({
  topicId: z.string(),
  topicName: z.string(),
  domainId: z.string(),
  subjectId: z.string(),
  subjectName: z.string(),
  categoryId: z.string(),
  lastAccessedAt: z.string().datetime(),
})

export type RecentTopic = z.infer<typeof recentTopicSchema>

export const recentTopicsResponseSchema = z.object({
  topics: z.array(recentTopicSchema),
})

export type RecentTopicsResponse = z.infer<typeof recentTopicsResponseSchema>

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

// 日次メトリクス取得で許容する最大日数（両端含む）。
// UIが要求する最大範囲は90日（直近90日）だが、手動指定やうるう年を考慮し
// 1年強（366日）を上限とする。範囲ループ（aggregateDateRange）の暴走（DoS）を防ぐ。
export const MAX_DAILY_METRICS_RANGE_DAYS = 366

const MS_PER_DAY = 24 * 60 * 60 * 1000

// from/to（ともに実在する YYYY-MM-DD）の範囲に含まれる日数（両端含む）を返す。
// from > to の場合は 0 以下の値を返す（順序チェックは呼び出し側で別途行う）。
const dailyMetricsRangeDays = (from: string, to: string): number => {
  const fromMs = Date.parse(`${from}T00:00:00Z`)
  const toMs = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return 0
  return Math.floor((toMs - fromMs) / MS_PER_DAY) + 1
}

// from <= to を前提に、範囲が上限日数以内かどうかを返す。
// from > to のとき（日数が 0 以下）は true を返し、順序チェックに委ねる。
export const isDailyMetricsRangeWithinLimit = (from: string, to: string): boolean =>
  dailyMetricsRangeDays(from, to) <= MAX_DAILY_METRICS_RANGE_DAYS

// Request schemas
export const getDailyMetricsRequestSchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
  })
  .refine(({ from, to }) => isDailyMetricsRangeWithinLimit(from, to), {
    message: `日付範囲が広すぎます。最大${MAX_DAILY_METRICS_RANGE_DAYS}日までにしてください`,
    path: ["to"],
  })

export type GetDailyMetricsRequest = z.infer<typeof getDailyMetricsRequestSchema>

// Response schemas（オンザフライ集計版）
export const dailyMetricsResponseSchema = z.array(dailyMetricSchema)

export type DailyMetricsResponse = z.infer<typeof dailyMetricsResponseSchema>

// API response wrapper (for { metrics: [...] } format)
export const dailyMetricsWrapperResponseSchema = z.object({
  metrics: z.array(dailyMetricSchema),
})

export type DailyMetricsWrapperResponse = z.infer<typeof dailyMetricsWrapperResponseSchema>
