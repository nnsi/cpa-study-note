import type { MetricsRepository, MetricSnapshot, TodayMetrics, DailyMetric } from "./repository"
import type {
  MetricSnapshot as MetricSnapshotResponse,
  DailyMetric as DailyMetricResponse,
} from "@cpa-study/shared/schemas"
import {
  MAX_DAILY_METRICS_RANGE_DAYS,
  isDailyMetricsRangeWithinLimit,
} from "@cpa-study/shared/schemas"
import { ok, err, type Result } from "@/shared/lib/result"
import { badRequest, type AppError } from "@/shared/lib/errors"
import type { Logger } from "@/shared/lib/logger"

export type MetricsDeps = {
  metricsRepo: MetricsRepository
  logger: Logger
}

const toResponse = (snapshot: MetricSnapshot): MetricSnapshotResponse => ({
  ...snapshot,
  createdAt: snapshot.createdAt.toISOString(),
})

const toDailyMetricResponse = (metric: DailyMetric): DailyMetricResponse => ({
  ...metric,
})

// 日付形式バリデーション
const isValidDateFormat = (date: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

// 日付範囲バリデーション
const isValidDateRange = (from: string, to: string): boolean => {
  return from <= to
}

// 日次メトリクス取得（オンザフライ集計）
export const getDailyMetrics = async (
  deps: MetricsDeps,
  userId: string,
  from: string,
  to: string,
  timezone: string
): Promise<Result<DailyMetricResponse[], AppError>> => {
  const { metricsRepo, logger } = deps
  if (!isValidDateFormat(from) || !isValidDateFormat(to)) {
    return err(badRequest("日付形式が不正です。YYYY-MM-DD形式で指定してください"))
  }

  if (!isValidDateRange(from, to)) {
    return err(badRequest("日付範囲が不正です。'from'は'to'以前の日付を指定してください"))
  }

  // 範囲が広すぎるとaggregateDateRangeが日単位ループで暴走する（DoS）ため上限を設ける
  if (!isDailyMetricsRangeWithinLimit(from, to)) {
    return err(
      badRequest(`日付範囲が広すぎます。最大${MAX_DAILY_METRICS_RANGE_DAYS}日までにしてください`)
    )
  }

  // オンザフライで集計（タイムゾーン考慮）
  const metrics = await metricsRepo.aggregateDateRange(userId, from, to, timezone)

  return ok(metrics.map(toDailyMetricResponse))
}

// 今日の日付を取得（YYYY-MM-DD形式、ユーザーのタイムゾーン基準）
// aggregateForDate/aggregateToday と同じタイムゾーン基準で「今日」を決定する
const getTodayDateString = (timezone: string): string => {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(now) // "YYYY-MM-DD"
}

// スナップショット作成（指定日、デフォルトは当日）
export const createSnapshot = async (
  deps: MetricsDeps,
  userId: string,
  timezone: string,
  date?: string
): Promise<Result<MetricSnapshotResponse, AppError>> => {
  const { metricsRepo, logger } = deps
  const targetDate = date ?? getTodayDateString(timezone)

  if (!isValidDateFormat(targetDate)) {
    return err(badRequest("日付形式が不正です。YYYY-MM-DD形式で指定してください"))
  }

  // 集計を実行（タイムゾーン考慮、aggregateDateRange と整合）
  const aggregation = await metricsRepo.aggregateForDate(userId, targetDate, timezone)

  // upsert で保存
  const snapshot = await metricsRepo.upsert(userId, targetDate, aggregation)

  return ok(toResponse(snapshot))
}

// 今日の活動メトリクス取得（リアルタイム集計、タイムゾーン考慮）
export const getTodayMetrics = async (
  deps: MetricsDeps,
  userId: string,
  timezone: string
): Promise<Result<TodayMetrics, AppError>> => {
  const { metricsRepo, logger } = deps
  const metrics = await metricsRepo.aggregateToday(userId, timezone)
  return ok(metrics)
}
