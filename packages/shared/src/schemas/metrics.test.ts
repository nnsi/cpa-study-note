import { describe, it, expect } from "vitest"
import {
  dateStringSchema,
  todayMetricsSchema,
  todayMetricsResponseSchema,
  recentTopicSchema,
  recentTopicsResponseSchema,
  dailyMetricSchema,
  getDailyMetricsRequestSchema,
  dailyMetricsResponseSchema,
  dailyMetricsWrapperResponseSchema,
} from "./metrics"

describe("dateStringSchema", () => {
  it("YYYY-MM-DD形式をパースできる", () => {
    expect(dateStringSchema.safeParse("2025-01-15").success).toBe(true)
  })

  it("不正な形式でエラー", () => {
    expect(dateStringSchema.safeParse("2025/01/15").success).toBe(false)
    expect(dateStringSchema.safeParse("01-15-2025").success).toBe(false)
    expect(dateStringSchema.safeParse("not-a-date").success).toBe(false)
  })

  it("空文字でエラー", () => {
    expect(dateStringSchema.safeParse("").success).toBe(false)
  })

  it("実在しない日付でエラー", () => {
    // 形式は正しいが暦上存在しない日付
    expect(dateStringSchema.safeParse("2026-13-01").success).toBe(false) // 13月
    expect(dateStringSchema.safeParse("2026-00-10").success).toBe(false) // 0月
    expect(dateStringSchema.safeParse("2026-02-30").success).toBe(false) // 2月30日
    expect(dateStringSchema.safeParse("2026-04-31").success).toBe(false) // 4月31日
    expect(dateStringSchema.safeParse("2026-01-32").success).toBe(false) // 32日
  })

  it("うるう年の2月29日は年によって判定が変わる", () => {
    expect(dateStringSchema.safeParse("2024-02-29").success).toBe(true) // うるう年
    expect(dateStringSchema.safeParse("2026-02-29").success).toBe(false) // 平年
  })
})

describe("todayMetricsSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = todayMetricsSchema.safeParse({
      sessionCount: 3,
      messageCount: 10,
      checkedTopicCount: 5,
    })
    expect(result.success).toBe(true)
  })

  it("0でも有効", () => {
    const result = todayMetricsSchema.safeParse({
      sessionCount: 0,
      messageCount: 0,
      checkedTopicCount: 0,
    })
    expect(result.success).toBe(true)
  })

  it("負の値でエラー", () => {
    const result = todayMetricsSchema.safeParse({
      sessionCount: -1,
      messageCount: 0,
      checkedTopicCount: 0,
    })
    expect(result.success).toBe(false)
  })

  it("小数でエラー", () => {
    const result = todayMetricsSchema.safeParse({
      sessionCount: 1.5,
      messageCount: 0,
      checkedTopicCount: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe("todayMetricsResponseSchema", () => {
  it("metricsオブジェクトでラップされたレスポンスをパースできる", () => {
    const result = todayMetricsResponseSchema.safeParse({
      metrics: { sessionCount: 1, messageCount: 2, checkedTopicCount: 3 },
    })
    expect(result.success).toBe(true)
  })
})

describe("recentTopicSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = recentTopicSchema.safeParse({
      topicId: "topic-1",
      topicName: "論点名",
      domainId: "domain-1",
      subjectId: "sub-1",
      subjectName: "科目名",
      categoryId: "cat-1",
      lastAccessedAt: "2025-01-01T00:00:00Z",
    })
    expect(result.success).toBe(true)
  })

  it("必須フィールド欠落でエラー", () => {
    const result = recentTopicSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("recentTopicsResponseSchema", () => {
  it("空配列でも有効", () => {
    const result = recentTopicsResponseSchema.safeParse({ topics: [] })
    expect(result.success).toBe(true)
  })
})

describe("dailyMetricSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = dailyMetricSchema.safeParse({
      date: "2025-06-01",
      checkedTopicCount: 3,
      sessionCount: 2,
      messageCount: 15,
      goodQuestionCount: 5,
    })
    expect(result.success).toBe(true)
  })

  it("dateが不正な形式でエラー", () => {
    const result = dailyMetricSchema.safeParse({
      date: "2025-1-1",
      checkedTopicCount: 0,
      sessionCount: 0,
      messageCount: 0,
      goodQuestionCount: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe("getDailyMetricsRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = getDailyMetricsRequestSchema.safeParse({
      from: "2025-01-01",
      to: "2025-01-31",
    })
    expect(result.success).toBe(true)
  })

  it("必須フィールド欠落でエラー", () => {
    const result = getDailyMetricsRequestSchema.safeParse({ from: "2025-01-01" })
    expect(result.success).toBe(false)
  })

  it("最大366日（両端含む）の範囲は許可される", () => {
    // 2024-01-01 〜 2024-12-31 は両端含めて366日（うるう年）
    const result = getDailyMetricsRequestSchema.safeParse({
      from: "2024-01-01",
      to: "2024-12-31",
    })
    expect(result.success).toBe(true)
  })

  it("366日を超える範囲はエラー", () => {
    const result = getDailyMetricsRequestSchema.safeParse({
      from: "2024-01-01",
      to: "2025-01-01", // 367日
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("日付範囲が広すぎます")
    }
  })

  it("from > to の場合は範囲チェックを通過する（順序チェックは呼び出し側の責務）", () => {
    // refineは範囲上限のみ検証し、from>toはスキーマでは弾かない
    const result = getDailyMetricsRequestSchema.safeParse({
      from: "2025-12-31",
      to: "2025-01-01",
    })
    expect(result.success).toBe(true)
  })
})

describe("dailyMetricsResponseSchema", () => {
  it("配列としてパースできる", () => {
    const result = dailyMetricsResponseSchema.safeParse([
      {
        date: "2025-01-01",
        checkedTopicCount: 1,
        sessionCount: 1,
        messageCount: 5,
        goodQuestionCount: 2,
      },
    ])
    expect(result.success).toBe(true)
  })

  it("空配列でも有効", () => {
    const result = dailyMetricsResponseSchema.safeParse([])
    expect(result.success).toBe(true)
  })
})

describe("dailyMetricsWrapperResponseSchema", () => {
  it("metricsキーでラップされたデータをパースできる", () => {
    const result = dailyMetricsWrapperResponseSchema.safeParse({ metrics: [] })
    expect(result.success).toBe(true)
  })
})
