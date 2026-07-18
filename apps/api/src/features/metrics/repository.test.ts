import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, seedTestData, type TestDatabase } from "../../test/mocks/db"
import { createMetricsRepository, type MetricsRepository } from "./repository"
import * as schema from "@cpa-study/db/schema"

describe("MetricsRepository", () => {
  let repository: MetricsRepository
  let testData: ReturnType<typeof seedTestData>
  let db: TestDatabase

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    testData = seedTestData(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createMetricsRepository(db as any)
  })

  describe("upsert", () => {
    it("新しいスナップショットを作成できる", async () => {
      const snapshot = await repository.upsert(testData.userId, "2026-02-01", {
        checkedTopicCount: 5,
        sessionCount: 3,
        messageCount: 15,
        goodQuestionCount: 2,
      })

      expect(snapshot.userId).toBe(testData.userId)
      expect(snapshot.date).toBe("2026-02-01")
      expect(snapshot.checkedTopicCount).toBe(5)
      expect(snapshot.sessionCount).toBe(3)
      expect(snapshot.messageCount).toBe(15)
      expect(snapshot.goodQuestionCount).toBe(2)
    })

    it("既存のスナップショットを更新できる", async () => {
      await repository.upsert(testData.userId, "2026-02-01", {
        checkedTopicCount: 5,
        sessionCount: 3,
        messageCount: 15,
        goodQuestionCount: 2,
      })

      const updated = await repository.upsert(testData.userId, "2026-02-01", {
        checkedTopicCount: 10,
        sessionCount: 5,
        messageCount: 25,
        goodQuestionCount: 4,
      })

      expect(updated.checkedTopicCount).toBe(10)
      expect(updated.sessionCount).toBe(5)
    })
  })

  describe("findByDate", () => {
    it("日付でスナップショットを取得できる", async () => {
      await repository.upsert(testData.userId, "2026-02-01", {
        checkedTopicCount: 5,
        sessionCount: 3,
        messageCount: 15,
        goodQuestionCount: 2,
      })

      const found = await repository.findByDate(testData.userId, "2026-02-01")

      expect(found).not.toBeNull()
      expect(found?.date).toBe("2026-02-01")
      expect(found?.checkedTopicCount).toBe(5)
    })

    it("存在しない日付はnullを返す", async () => {
      const found = await repository.findByDate(testData.userId, "2099-01-01")

      expect(found).toBeNull()
    })
  })

  describe("findByDateRange", () => {
    it("日付範囲でスナップショットを取得できる", async () => {
      await repository.upsert(testData.userId, "2026-02-01", {
        checkedTopicCount: 1,
        sessionCount: 1,
        messageCount: 5,
        goodQuestionCount: 0,
      })
      await repository.upsert(testData.userId, "2026-02-02", {
        checkedTopicCount: 2,
        sessionCount: 2,
        messageCount: 10,
        goodQuestionCount: 1,
      })
      await repository.upsert(testData.userId, "2026-02-03", {
        checkedTopicCount: 3,
        sessionCount: 3,
        messageCount: 15,
        goodQuestionCount: 2,
      })

      const results = await repository.findByDateRange(testData.userId, "2026-02-01", "2026-02-03")

      expect(results).toHaveLength(3)
      expect(results[0].date).toBe("2026-02-01")
      expect(results[2].date).toBe("2026-02-03")
    })

    it("範囲外のデータは含まない", async () => {
      await repository.upsert(testData.userId, "2026-01-31", {
        checkedTopicCount: 0,
        sessionCount: 0,
        messageCount: 0,
        goodQuestionCount: 0,
      })
      await repository.upsert(testData.userId, "2026-02-01", {
        checkedTopicCount: 1,
        sessionCount: 1,
        messageCount: 5,
        goodQuestionCount: 0,
      })

      const results = await repository.findByDateRange(testData.userId, "2026-02-01", "2026-02-28")

      expect(results).toHaveLength(1)
      expect(results[0].date).toBe("2026-02-01")
    })

    it("データがない場合は空配列を返す", async () => {
      const results = await repository.findByDateRange(testData.userId, "2099-01-01", "2099-01-31")

      expect(results).toHaveLength(0)
    })
  })

  describe("aggregateForDate", () => {
    const tz = "Asia/Tokyo"
    // now が属するタイムゾーン基準の日付文字列を返す（aggregateForDateと同じ基準）
    const localDateStr = (date: Date, timezone: string) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date)

    it("セッション・メッセージ数を集計する", async () => {
      const now = new Date()
      // 当日のセッションを作成
      const sessionId = "session-agg-1"
      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // メッセージを作成
      db.insert(schema.chatMessages)
        .values({
          id: "msg-agg-1",
          sessionId,
          role: "user",
          content: "テスト質問",
          createdAt: now,
        })
        .run()
      db.insert(schema.chatMessages)
        .values({
          id: "msg-agg-2",
          sessionId,
          role: "assistant",
          content: "テスト回答",
          createdAt: now,
        })
        .run()

      // タイムゾーン基準の当日日付を生成（now は必ずこの日の範囲内）
      const dateStr = localDateStr(now, tz)

      const result = await repository.aggregateForDate(testData.userId, dateStr, tz)

      expect(result.sessionCount).toBeGreaterThanOrEqual(1)
      expect(result.messageCount).toBeGreaterThanOrEqual(1) // userメッセージのみカウント
    })

    it("good質問はユーザーメッセージのみを集計する（assistantのgoodは除外）", async () => {
      const now = new Date()
      const sessionId = "session-good-1"
      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // ユーザーのgood質問（カウント対象）
      db.insert(schema.chatMessages)
        .values({
          id: "msg-good-user",
          sessionId,
          role: "user",
          content: "良い質問",
          questionQuality: "good",
          createdAt: now,
        })
        .run()
      // assistantメッセージにgoodが付いていてもカウントしない
      db.insert(schema.chatMessages)
        .values({
          id: "msg-good-assistant",
          sessionId,
          role: "assistant",
          content: "回答",
          questionQuality: "good",
          createdAt: now,
        })
        .run()

      const dateStr = localDateStr(now, tz)
      const result = await repository.aggregateForDate(testData.userId, dateStr, tz)

      expect(result.goodQuestionCount).toBe(1)
    })

    it("翌日0時ちょうどのレコードは当日に計上しない（境界）", async () => {
      // 対象日を固定（過去日）してタイムゾーン境界を明示的に検証する
      const targetDate = "2026-03-10"
      // Asia/Tokyo(+9) の翌日0時 = 2026-03-11T00:00+09:00 = 2026-03-10T15:00Z
      const nextDayLocalMidnightUtc = new Date("2026-03-10T15:00:00.000Z")
      const sessionId = "session-boundary-1"
      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: nextDayLocalMidnightUtc,
          updatedAt: nextDayLocalMidnightUtc,
        })
        .run()
      db.insert(schema.chatMessages)
        .values({
          id: "msg-boundary-1",
          sessionId,
          role: "user",
          content: "境界の質問",
          questionQuality: "good",
          createdAt: nextDayLocalMidnightUtc,
        })
        .run()

      const result = await repository.aggregateForDate(testData.userId, targetDate, tz)

      // 翌日0時ちょうどのレコードは当日には含まれない
      expect(result.sessionCount).toBe(0)
      expect(result.messageCount).toBe(0)
      expect(result.goodQuestionCount).toBe(0)
    })

    it("データがない日付はゼロを返す", async () => {
      const result = await repository.aggregateForDate(testData.userId, "2099-01-01", tz)

      expect(result.checkedTopicCount).toBe(0)
      expect(result.sessionCount).toBe(0)
      expect(result.messageCount).toBe(0)
      expect(result.goodQuestionCount).toBe(0)
    })
  })

  describe("aggregateToday", () => {
    it("今日のメトリクスを取得する", async () => {
      const result = await repository.aggregateToday(testData.userId, "Asia/Tokyo")

      expect(typeof result.sessionCount).toBe("number")
      expect(typeof result.messageCount).toBe("number")
      expect(typeof result.checkedTopicCount).toBe("number")
    })
  })

  describe("aggregateDateRange", () => {
    it("日付範囲のメトリクスを取得する", async () => {
      const result = await repository.aggregateDateRange(
        testData.userId,
        "2026-02-01",
        "2026-02-03",
        "Asia/Tokyo"
      )

      expect(result).toHaveLength(3)
      expect(result[0].date).toBe("2026-02-01")
      expect(result[1].date).toBe("2026-02-02")
      expect(result[2].date).toBe("2026-02-03")
      result.forEach((day) => {
        expect(typeof day.checkedTopicCount).toBe("number")
        expect(typeof day.sessionCount).toBe("number")
        expect(typeof day.messageCount).toBe("number")
        expect(typeof day.goodQuestionCount).toBe("number")
      })
    })

    it("データがなくてもすべての日付を返す", async () => {
      const result = await repository.aggregateDateRange(
        "non-existent-user",
        "2026-02-01",
        "2026-02-03",
        "Asia/Tokyo"
      )

      expect(result).toHaveLength(3)
      result.forEach((day) => {
        expect(day.sessionCount).toBe(0)
        expect(day.messageCount).toBe(0)
      })
    })
  })
})
