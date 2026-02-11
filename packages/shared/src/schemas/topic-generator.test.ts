import { describe, it, expect } from "vitest"
import {
  suggestTopicsRequestSchema,
  topicSuggestionSchema,
  topicGeneratorChunkSchema,
} from "./topic-generator"

describe("suggestTopicsRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = suggestTopicsRequestSchema.safeParse({
      prompt: "財務会計論の論点を提案して",
    })
    expect(result.success).toBe(true)
  })

  it("promptが空文字でエラー", () => {
    const result = suggestTopicsRequestSchema.safeParse({ prompt: "" })
    expect(result.success).toBe(false)
  })

  it("promptが2000文字超でエラー", () => {
    const result = suggestTopicsRequestSchema.safeParse({
      prompt: "a".repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe("topicSuggestionSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = topicSuggestionSchema.safeParse({
      categories: [
        {
          name: "資産会計",
          topics: [
            { name: "棚卸資産", description: "棚卸資産の評価方法" },
          ],
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("descriptionがnullでもデフォルト値で有効", () => {
    const result = topicSuggestionSchema.safeParse({
      categories: [
        {
          name: "カテゴリ",
          topics: [{ name: "論点名" }],
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.categories[0].topics[0].description).toBeNull()
    }
  })

  it("空のcategories配列でも有効", () => {
    const result = topicSuggestionSchema.safeParse({ categories: [] })
    expect(result.success).toBe(true)
  })

  it("空のtopics配列でも有効", () => {
    const result = topicSuggestionSchema.safeParse({
      categories: [{ name: "空カテゴリ", topics: [] }],
    })
    expect(result.success).toBe(true)
  })
})

describe("topicGeneratorChunkSchema", () => {
  it("textチャンクをパースできる", () => {
    const result = topicGeneratorChunkSchema.safeParse({
      type: "text",
      content: "テキスト",
    })
    expect(result.success).toBe(true)
  })

  it("errorチャンクをパースできる", () => {
    const result = topicGeneratorChunkSchema.safeParse({
      type: "error",
      error: "エラー",
    })
    expect(result.success).toBe(true)
  })

  it("doneチャンクをパースできる", () => {
    const result = topicGeneratorChunkSchema.safeParse({ type: "done" })
    expect(result.success).toBe(true)
  })

  it("無効なtypeでエラー", () => {
    const result = topicGeneratorChunkSchema.safeParse({ type: "unknown" })
    expect(result.success).toBe(false)
  })
})

// ===== 境界値テスト =====

describe("suggestTopicsRequestSchema - 境界値", () => {
  it("promptがちょうど2000文字でOK（max境界）", () => {
    const result = suggestTopicsRequestSchema.safeParse({
      prompt: "a".repeat(2000),
    })
    expect(result.success).toBe(true)
  })

  it("promptが1文字でOK（min境界）", () => {
    const result = suggestTopicsRequestSchema.safeParse({
      prompt: "a",
    })
    expect(result.success).toBe(true)
  })
})
