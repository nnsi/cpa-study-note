import { describe, it, expect } from "vitest"
import { topicTypeSchema, difficultySchema, topicSchema } from "./topic"

describe("topicTypeSchema", () => {
  it("編集UIが保存する自由記述の日本語を受理する", () => {
    // enumではなく自由文字列。実データは「計算」「理論」「事例」等
    expect(topicTypeSchema.safeParse("計算").success).toBe(true)
    expect(topicTypeSchema.safeParse("理論").success).toBe(true)
    expect(topicTypeSchema.safeParse("事例").success).toBe(true)
    // 旧enum値も文字列として受理される
    expect(topicTypeSchema.safeParse("theory").success).toBe(true)
  })

  it("空文字も許可する（未指定と区別しない）", () => {
    expect(topicTypeSchema.safeParse("").success).toBe(true)
  })

  it("50文字を超えるとエラー", () => {
    expect(topicTypeSchema.safeParse("あ".repeat(50)).success).toBe(true)
    expect(topicTypeSchema.safeParse("あ".repeat(51)).success).toBe(false)
  })

  it("文字列以外はエラー", () => {
    expect(topicTypeSchema.safeParse(123).success).toBe(false)
    expect(topicTypeSchema.safeParse(null).success).toBe(false)
  })
})

describe("difficultySchema", () => {
  it("enumの値のみ受理する", () => {
    expect(difficultySchema.safeParse("basic").success).toBe(true)
    expect(difficultySchema.safeParse("intermediate").success).toBe(true)
    expect(difficultySchema.safeParse("advanced").success).toBe(true)
    expect(difficultySchema.safeParse("hard").success).toBe(false)
  })
})

describe("topicSchema", () => {
  const base = {
    id: "topic-1",
    userId: "user-1",
    categoryId: "cat-1",
    name: "論点名",
    description: null,
    difficulty: null,
    topicType: null,
    aiSystemPrompt: null,
    displayOrder: 0,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    deletedAt: null,
  }

  it("自由記述のtopicTypeを持つ論点を受理する", () => {
    const result = topicSchema.safeParse({ ...base, topicType: "計算" })
    expect(result.success).toBe(true)
  })

  it("topicTypeがnullでも受理する", () => {
    const result = topicSchema.safeParse({ ...base, topicType: null })
    expect(result.success).toBe(true)
  })
})
