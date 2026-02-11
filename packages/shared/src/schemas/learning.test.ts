import { describe, it, expect } from "vitest"
import {
  recentTopicsQuerySchema,
  progressResponseSchema,
  userProgressListResponseSchema,
  subjectProgressStatsSchema,
  subjectProgressStatsListResponseSchema,
} from "./learning"

describe("recentTopicsQuerySchema", () => {
  it("デフォルト値でパースできる", () => {
    const result = recentTopicsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(10)
    }
  })

  it("文字列の数値をcoerceできる", () => {
    const result = recentTopicsQuerySchema.safeParse({ limit: "20" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(20)
    }
  })

  it("limitが1未満でエラー", () => {
    const result = recentTopicsQuerySchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })

  it("limitが50超でエラー", () => {
    const result = recentTopicsQuerySchema.safeParse({ limit: 51 })
    expect(result.success).toBe(false)
  })
})

describe("progressResponseSchema", () => {
  const validProgress = {
    userId: "user-1",
    topicId: "topic-1",
    understood: true,
    lastAccessedAt: "2025-01-01T00:00:00Z",
    questionCount: 5,
    goodQuestionCount: 3,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  }

  it("有効なデータをパースできる", () => {
    const result = progressResponseSchema.safeParse(validProgress)
    expect(result.success).toBe(true)
  })

  it("lastAccessedAtがnullでも有効", () => {
    const result = progressResponseSchema.safeParse({
      ...validProgress,
      lastAccessedAt: null,
    })
    expect(result.success).toBe(true)
  })

  it("必須フィールド欠落でエラー", () => {
    const result = progressResponseSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("understoodがboolean以外でエラー", () => {
    const result = progressResponseSchema.safeParse({
      ...validProgress,
      understood: "yes",
    })
    expect(result.success).toBe(false)
  })
})

describe("userProgressListResponseSchema", () => {
  it("空配列でも有効", () => {
    const result = userProgressListResponseSchema.safeParse({ progress: [] })
    expect(result.success).toBe(true)
  })
})

describe("subjectProgressStatsSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = subjectProgressStatsSchema.safeParse({
      subjectId: "sub-1",
      subjectName: "財務会計論",
      totalTopics: 100,
      understoodTopics: 50,
    })
    expect(result.success).toBe(true)
  })
})

describe("subjectProgressStatsListResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = subjectProgressStatsListResponseSchema.safeParse({
      stats: [],
    })
    expect(result.success).toBe(true)
  })
})

// ===== 境界値テスト =====

describe("recentTopicsQuerySchema - 境界値", () => {
  it("limitが1でOK（min境界）", () => {
    const result = recentTopicsQuerySchema.safeParse({ limit: 1 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(1)
    }
  })

  it("limitが50でOK（max境界）", () => {
    const result = recentTopicsQuerySchema.safeParse({ limit: 50 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
    }
  })
})
