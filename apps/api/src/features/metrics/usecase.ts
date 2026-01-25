import type { MetricsRepository, MetricSnapshot, TodayMetrics } from "./repository"

type MetricsDeps = {
  metricsRepo: MetricsRepository
}

type MetricSnapshotResponse = {
  id: string
  date: string
  userId: string
  checkedTopicCount: number
  sessionCount: number
  messageCount: number
  goodQuestionCount: number
  createdAt: string
}

const toResponse = (snapshot: MetricSnapshot): MetricSnapshotResponse => ({
  ...snapshot,
  createdAt: snapshot.createdAt.toISOString(),
})

// 日付形式バリデーション
const isValidDateFormat = (date: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

// 日付範囲バリデーション
const isValidDateRange = (from: string, to: string): boolean => {
  return from <= to
}

// 日次メトリクス取得
export const getDailyMetrics = async (
  deps: MetricsDeps,
  userId: string,
  from: string,
  to: string
): Promise<
  | { ok: true; metrics: MetricSnapshotResponse[] }
  | { ok: false; error: string; status: number }
> => {
  if (!isValidDateFormat(from) || !isValidDateFormat(to)) {
    return {
      ok: false,
      error: "Invalid date format. Use YYYY-MM-DD",
      status: 400,
    }
  }

  if (!isValidDateRange(from, to)) {
    return {
      ok: false,
      error: "Invalid date range. 'from' must be before or equal to 'to'",
      status: 400,
    }
  }

  const snapshots = await deps.metricsRepo.findByDateRange(userId, from, to)

  return {
    ok: true,
    metrics: snapshots.map(toResponse),
  }
}

// 今日の日付を取得（YYYY-MM-DD形式）
const getTodayDateString = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// スナップショット作成（指定日、デフォルトは当日）
export const createSnapshot = async (
  deps: MetricsDeps,
  userId: string,
  date?: string
): Promise<
  | { ok: true; snapshot: MetricSnapshotResponse }
  | { ok: false; error: string; status: number }
> => {
  const targetDate = date ?? getTodayDateString()

  if (!isValidDateFormat(targetDate)) {
    return {
      ok: false,
      error: "Invalid date format. Use YYYY-MM-DD",
      status: 400,
    }
  }

  // 集計を実行
  const aggregation = await deps.metricsRepo.aggregateForDate(userId, targetDate)

  // upsert で保存
  const snapshot = await deps.metricsRepo.upsert(userId, targetDate, aggregation)

  return {
    ok: true,
    snapshot: toResponse(snapshot),
  }
}

// 今日の活動メトリクス取得（リアルタイム集計）
export const getTodayMetrics = async (
  deps: MetricsDeps,
  userId: string
): Promise<TodayMetrics> => {
  return deps.metricsRepo.aggregateToday(userId)
}
