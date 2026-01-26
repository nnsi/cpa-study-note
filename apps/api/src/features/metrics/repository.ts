import { eq, and, gte, lte, count, countDistinct } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  metricSnapshots,
  chatSessions,
  chatMessages,
  topicCheckHistory,
} from "@cpa-study/db/schema"

export type MetricSnapshot = {
  id: string
  date: string
  userId: string
  checkedTopicCount: number
  sessionCount: number
  messageCount: number
  goodQuestionCount: number
  createdAt: Date
}

export type DailyAggregation = {
  checkedTopicCount: number
  sessionCount: number
  messageCount: number
  goodQuestionCount: number
}

export type TodayMetrics = {
  sessionCount: number
  messageCount: number
  checkedTopicCount: number
}

export type DailyMetric = {
  date: string
  checkedTopicCount: number
  sessionCount: number
  messageCount: number
  goodQuestionCount: number
}

export type MetricsRepository = {
  findByDateRange: (
    userId: string,
    from: string,
    to: string
  ) => Promise<MetricSnapshot[]>
  findByDate: (userId: string, date: string) => Promise<MetricSnapshot | null>
  upsert: (
    userId: string,
    date: string,
    data: DailyAggregation
  ) => Promise<MetricSnapshot>
  aggregateForDate: (
    userId: string,
    date: string
  ) => Promise<DailyAggregation>
  aggregateToday: (userId: string, timezone: string) => Promise<TodayMetrics>
  aggregateDateRange: (
    userId: string,
    from: string,
    to: string,
    timezone: string
  ) => Promise<DailyMetric[]>
}

// タイムゾーンのオフセット（分）を取得
// 例: "Asia/Tokyo" -> 540 (UTCから9時間進んでいる)
const getTimezoneOffsetMinutes = (timezone: string): number => {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0)

    const utcHour = now.getUTCHours()
    const utcMinute = now.getUTCMinutes()

    let offsetMinutes = (hour * 60 + minute) - (utcHour * 60 + utcMinute)
    // 日付をまたぐ場合の補正
    if (offsetMinutes > 12 * 60) offsetMinutes -= 24 * 60
    if (offsetMinutes < -12 * 60) offsetMinutes += 24 * 60

    return offsetMinutes
  } catch {
    // 無効なタイムゾーンの場合は Asia/Tokyo (UTC+9) のオフセットを使用
    return 9 * 60
  }
}

// タイムゾーンを考慮した日付の開始時刻（UTC）を取得
const getLocalDayStartUtc = (dateStr: string, timezone: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  const offsetMinutes = getTimezoneOffsetMinutes(timezone)
  // ローカルの0時0分をUTCに変換
  const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60 * 1000
  return new Date(utcMs)
}

// タイムゾーンを考慮した日付の終了時刻（翌日の開始時刻）を取得
const getLocalDayEndUtc = (dateStr: string, timezone: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  const offsetMinutes = getTimezoneOffsetMinutes(timezone)
  // ローカルの翌日0時0分をUTCに変換
  const utcMs = Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0) - offsetMinutes * 60 * 1000
  return new Date(utcMs)
}

// 日付文字列を Date オブジェクトに変換（UTCの0時0分0秒）
const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

// 日付文字列の翌日を取得
const getNextDay = (dateStr: string): Date => {
  const date = parseDate(dateStr)
  date.setUTCDate(date.getUTCDate() + 1)
  return date
}

// タイムスタンプからタイムゾーン考慮した日付文字列を取得
const timestampToLocalDateStr = (timestamp: Date, offsetMinutes: number): string => {
  const localMs = timestamp.getTime() + offsetMinutes * 60 * 1000
  const localDate = new Date(localMs)
  const year = localDate.getUTCFullYear()
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(localDate.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// チェック履歴から各トピックの最新状態を計算してチェック済み数を返す
const calculateCheckedCount = (
  history: Array<{ topicId: string; action: string; checkedAt: Date }>,
  endDate: Date
): number => {
  const topicState = new Map<string, boolean>()

  for (const h of history) {
    if (h.checkedAt <= endDate) {
      topicState.set(h.topicId, h.action === "checked")
    }
  }

  let checkedCount = 0
  for (const isChecked of topicState.values()) {
    if (isChecked) checkedCount++
  }
  return checkedCount
}

export const createMetricsRepository = (db: Db): MetricsRepository => ({
  findByDateRange: async (userId, from, to) => {
    const results = await db
      .select()
      .from(metricSnapshots)
      .where(
        and(
          eq(metricSnapshots.userId, userId),
          gte(metricSnapshots.date, from),
          lte(metricSnapshots.date, to)
        )
      )
      .orderBy(metricSnapshots.date)
    return results
  },

  findByDate: async (userId, date) => {
    const result = await db
      .select()
      .from(metricSnapshots)
      .where(
        and(eq(metricSnapshots.userId, userId), eq(metricSnapshots.date, date))
      )
      .limit(1)
    return result[0] ?? null
  },

  upsert: async (userId, date, data) => {
    const existing = await db
      .select()
      .from(metricSnapshots)
      .where(
        and(eq(metricSnapshots.userId, userId), eq(metricSnapshots.date, date))
      )
      .limit(1)

    const now = new Date()

    if (existing[0]) {
      await db
        .update(metricSnapshots)
        .set({
          checkedTopicCount: data.checkedTopicCount,
          sessionCount: data.sessionCount,
          messageCount: data.messageCount,
          goodQuestionCount: data.goodQuestionCount,
        })
        .where(eq(metricSnapshots.id, existing[0].id))

      return {
        ...existing[0],
        ...data,
      }
    }

    const id = crypto.randomUUID()
    await db.insert(metricSnapshots).values({
      id,
      date,
      userId,
      ...data,
      createdAt: now,
    })

    return {
      id,
      date,
      userId,
      ...data,
      createdAt: now,
    }
  },

  aggregateForDate: async (userId, date) => {
    const dayStart = parseDate(date)
    const dayEnd = getNextDay(date)

    // チェック済み論点数: その日の終わり時点でcheckedになっているトピック数
    // 全履歴を取得してJSで最新状態を計算
    const allHistory = await db
      .select({
        topicId: topicCheckHistory.topicId,
        action: topicCheckHistory.action,
        checkedAt: topicCheckHistory.checkedAt,
      })
      .from(topicCheckHistory)
      .where(
        and(
          eq(topicCheckHistory.userId, userId),
          lte(topicCheckHistory.checkedAt, dayEnd)
        )
      )
      .orderBy(topicCheckHistory.checkedAt)

    const checkedTopicCount = calculateCheckedCount(allHistory, dayEnd)

    // その日に作成されたセッション数
    const sessionCountResult = await db
      .select({ count: count() })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.userId, userId),
          gte(chatSessions.createdAt, dayStart),
          lte(chatSessions.createdAt, dayEnd)
        )
      )
    const sessionCount = sessionCountResult[0]?.count ?? 0

    // その日に作成されたメッセージ数（ユーザーのみ）
    const messageCountResult = await db
      .select({ count: count() })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatSessions.userId, userId),
          eq(chatMessages.role, "user"),
          gte(chatMessages.createdAt, dayStart),
          lte(chatMessages.createdAt, dayEnd)
        )
      )
    const messageCount = messageCountResult[0]?.count ?? 0

    // その日に評価された good 質問数
    const goodQuestionCountResult = await db
      .select({ count: count() })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatSessions.userId, userId),
          eq(chatMessages.questionQuality, "good"),
          gte(chatMessages.createdAt, dayStart),
          lte(chatMessages.createdAt, dayEnd)
        )
      )
    const goodQuestionCount = goodQuestionCountResult[0]?.count ?? 0

    return {
      checkedTopicCount,
      sessionCount,
      messageCount,
      goodQuestionCount,
    }
  },

  aggregateToday: async (userId, timezone) => {
    // タイムゾーンを考慮した今日の日付を取得
    const now = new Date()
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    const todayStr = formatter.format(now) // "YYYY-MM-DD" format
    const dayStart = getLocalDayStartUtc(todayStr, timezone)
    const dayEnd = getLocalDayEndUtc(todayStr, timezone)

    // 今日のセッション数
    const sessionCountResult = await db
      .select({ count: count() })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.userId, userId),
          gte(chatSessions.createdAt, dayStart),
          lte(chatSessions.createdAt, dayEnd)
        )
      )
    const sessionCount = sessionCountResult[0]?.count ?? 0

    // 今日のメッセージ数（ユーザーのみ）
    const messageCountResult = await db
      .select({ count: count() })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatSessions.userId, userId),
          eq(chatMessages.role, "user"),
          gte(chatMessages.createdAt, dayStart),
          lte(chatMessages.createdAt, dayEnd)
        )
      )
    const messageCount = messageCountResult[0]?.count ?? 0

    // 今日チェックした論点数（topicCheckHistoryから）
    const checkedCountResult = await db
      .select({ count: countDistinct(topicCheckHistory.topicId) })
      .from(topicCheckHistory)
      .where(
        and(
          eq(topicCheckHistory.userId, userId),
          eq(topicCheckHistory.action, "checked"),
          gte(topicCheckHistory.checkedAt, dayStart),
          lte(topicCheckHistory.checkedAt, dayEnd)
        )
      )
    const checkedTopicCount = checkedCountResult[0]?.count ?? 0

    return {
      sessionCount,
      messageCount,
      checkedTopicCount,
    }
  },

  aggregateDateRange: async (userId, from, to, timezone) => {
    // 日付範囲の配列を生成
    const dates: string[] = []
    const current = parseDate(from)
    const end = parseDate(to)

    while (current <= end) {
      const year = current.getUTCFullYear()
      const month = String(current.getUTCMonth() + 1).padStart(2, "0")
      const day = String(current.getUTCDate()).padStart(2, "0")
      dates.push(`${year}-${month}-${day}`)
      current.setUTCDate(current.getUTCDate() + 1)
    }

    // タイムゾーンを考慮した日付範囲（UTC）
    const fromDateUtc = getLocalDayStartUtc(from, timezone)
    const toDateUtc = getLocalDayEndUtc(to, timezone)
    const offsetMinutes = getTimezoneOffsetMinutes(timezone)

    // セッションを取得してJSで日別集計
    const sessions = await db
      .select({ createdAt: chatSessions.createdAt })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.userId, userId),
          gte(chatSessions.createdAt, fromDateUtc),
          lte(chatSessions.createdAt, toDateUtc)
        )
      )

    const sessionMap = new Map<string, number>()
    for (const s of sessions) {
      const dateStr = timestampToLocalDateStr(s.createdAt, offsetMinutes)
      sessionMap.set(dateStr, (sessionMap.get(dateStr) ?? 0) + 1)
    }

    // メッセージを取得してJSで日別集計（ユーザーのみ）
    const messages = await db
      .select({
        createdAt: chatMessages.createdAt,
        questionQuality: chatMessages.questionQuality,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatSessions.userId, userId),
          eq(chatMessages.role, "user"),
          gte(chatMessages.createdAt, fromDateUtc),
          lte(chatMessages.createdAt, toDateUtc)
        )
      )

    const messageMap = new Map<string, number>()
    const goodQuestionMap = new Map<string, number>()
    for (const m of messages) {
      const dateStr = timestampToLocalDateStr(m.createdAt, offsetMinutes)
      messageMap.set(dateStr, (messageMap.get(dateStr) ?? 0) + 1)
      if (m.questionQuality === "good") {
        goodQuestionMap.set(dateStr, (goodQuestionMap.get(dateStr) ?? 0) + 1)
      }
    }

    // チェック履歴を取得
    const allHistory = await db
      .select({
        topicId: topicCheckHistory.topicId,
        action: topicCheckHistory.action,
        checkedAt: topicCheckHistory.checkedAt,
      })
      .from(topicCheckHistory)
      .where(
        and(
          eq(topicCheckHistory.userId, userId),
          lte(topicCheckHistory.checkedAt, toDateUtc)
        )
      )
      .orderBy(topicCheckHistory.checkedAt)

    // 各日の終わり時点でのチェック状態を計算（タイムゾーン考慮）
    const checkedByDate = new Map<string, number>()
    const topicState = new Map<string, boolean>()

    let historyIndex = 0
    for (const date of dates) {
      const dayEndUtc = getLocalDayEndUtc(date, timezone)

      // この日の終わりまでの履歴を処理
      while (historyIndex < allHistory.length && allHistory[historyIndex].checkedAt <= dayEndUtc) {
        const h = allHistory[historyIndex]
        topicState.set(h.topicId, h.action === "checked")
        historyIndex++
      }

      // チェック済みトピック数をカウント
      let checkedCount = 0
      for (const isChecked of topicState.values()) {
        if (isChecked) checkedCount++
      }
      checkedByDate.set(date, checkedCount)
    }

    // 結果を組み立て
    return dates.map((date) => ({
      date,
      checkedTopicCount: checkedByDate.get(date) ?? 0,
      sessionCount: sessionMap.get(date) ?? 0,
      messageCount: messageMap.get(date) ?? 0,
      goodQuestionCount: goodQuestionMap.get(date) ?? 0,
    }))
  },
})
