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
