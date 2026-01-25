import type { DailyMetric } from "./api"

export type DateRange = "7days" | "30days" | "90days"

export type ChartDataPoint = {
  date: string
  displayDate: string
  checkedTopicCount: number
  sessionCount: number
  messageCount: number
  goodQuestionCount: number
}

/**
 * 日付範囲からfrom/to文字列を計算
 */
export const getDateRangeParams = (
  range: DateRange
): { from: string; to: string } => {
  const today = new Date()
  const to = formatDate(today)

  const daysMap: Record<DateRange, number> = {
    "7days": 6,
    "30days": 29,
    "90days": 89,
  }

  const fromDate = new Date(today)
  fromDate.setDate(fromDate.getDate() - daysMap[range])
  const from = formatDate(fromDate)

  return { from, to }
}

/**
 * Date -> YYYY-MM-DD 形式の文字列
 */
export const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * YYYY-MM-DD -> M/D 形式の表示用文字列
 */
export const formatDisplayDate = (dateStr: string): string => {
  const [, month, day] = dateStr.split("-")
  return `${Number(month)}/${Number(day)}`
}

/**
 * 指定期間の全日付を生成（データがない日も含む）
 */
export const generateDateRange = (from: string, to: string): string[] => {
  const dates: string[] = []
  const current = new Date(from + "T00:00:00")
  const end = new Date(to + "T00:00:00")

  while (current <= end) {
    dates.push(formatDate(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * APIレスポンスをチャートデータに変換
 * データがない日は0で埋める
 */
export const transformToChartData = (
  metrics: DailyMetric[],
  from: string,
  to: string
): ChartDataPoint[] => {
  const dateRange = generateDateRange(from, to)
  const metricsMap = new Map(metrics.map((m) => [m.date, m]))

  return dateRange.map((date) => {
    const metric = metricsMap.get(date)
    return {
      date,
      displayDate: formatDisplayDate(date),
      checkedTopicCount: metric?.checkedTopicCount ?? 0,
      sessionCount: metric?.sessionCount ?? 0,
      messageCount: metric?.messageCount ?? 0,
      goodQuestionCount: metric?.goodQuestionCount ?? 0,
    }
  })
}

/**
 * 期間の表示ラベル
 */
export const getRangeLabel = (range: DateRange): string => {
  const labels: Record<DateRange, string> = {
    "7days": "直近7日",
    "30days": "直近30日",
    "90days": "直近90日",
  }
  return labels[range]
}
