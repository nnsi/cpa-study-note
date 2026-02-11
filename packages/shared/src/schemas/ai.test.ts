import { describe, it, expect } from "vitest"
import {
  streamChunkTypeSchema,
  streamChunkSchema,
  aiMessageSchema,
} from "./ai"

describe("streamChunkTypeSchema", () => {
  it("有効な値をパースできる", () => {
    expect(streamChunkTypeSchema.safeParse("text").success).toBe(true)
    expect(streamChunkTypeSchema.safeParse("error").success).toBe(true)
    expect(streamChunkTypeSchema.safeParse("done").success).toBe(true)
  })

  it("無効な値でエラー", () => {
    expect(streamChunkTypeSchema.safeParse("stream").success).toBe(false)
  })
})

describe("streamChunkSchema", () => {
  it("textチャンクをパースできる", () => {
    const result = streamChunkSchema.safeParse({
      type: "text",
      content: "回答テキスト",
    })
    expect(result.success).toBe(true)
  })

  it("errorチャンクをパースできる", () => {
    const result = streamChunkSchema.safeParse({
      type: "error",
      error: "エラーメッセージ",
    })
    expect(result.success).toBe(true)
  })

  it("doneチャンクをパースできる", () => {
    const result = streamChunkSchema.safeParse({ type: "done" })
    expect(result.success).toBe(true)
  })

  it("contentとerrorはオプション", () => {
    const result = streamChunkSchema.safeParse({ type: "text" })
    expect(result.success).toBe(true)
  })

  it("type欠落でエラー", () => {
    const result = streamChunkSchema.safeParse({ content: "テキスト" })
    expect(result.success).toBe(false)
  })
})

describe("aiMessageSchema", () => {
  it("userメッセージをパースできる", () => {
    const result = aiMessageSchema.safeParse({
      role: "user",
      content: "質問テキスト",
    })
    expect(result.success).toBe(true)
  })

  it("assistantメッセージをパースできる", () => {
    const result = aiMessageSchema.safeParse({
      role: "assistant",
      content: "回答テキスト",
    })
    expect(result.success).toBe(true)
  })

  it("systemメッセージをパースできる", () => {
    const result = aiMessageSchema.safeParse({
      role: "system",
      content: "システムプロンプト",
    })
    expect(result.success).toBe(true)
  })

  it("imageUrlはオプション", () => {
    const result = aiMessageSchema.safeParse({
      role: "user",
      content: "画像付き質問",
      imageUrl: "https://example.com/image.png",
    })
    expect(result.success).toBe(true)
  })

  it("不正なroleでエラー", () => {
    const result = aiMessageSchema.safeParse({
      role: "admin",
      content: "テキスト",
    })
    expect(result.success).toBe(false)
  })

  it("content欠落でエラー", () => {
    const result = aiMessageSchema.safeParse({ role: "user" })
    expect(result.success).toBe(false)
  })
})
