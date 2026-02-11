import { describe, it, expect } from "vitest"
import { z } from "zod"
import { stripCodeBlock, parseLLMJson } from "./ai-utils"

describe("stripCodeBlock", () => {
  it("```json で囲まれたコンテンツを抽出できる", () => {
    const input = '```json\n{"key": "value"}\n```'
    expect(stripCodeBlock(input)).toBe('{"key": "value"}')
  })

  it("``` で囲まれたコンテンツを抽出できる", () => {
    const input = '```\n{"key": "value"}\n```'
    expect(stripCodeBlock(input)).toBe('{"key": "value"}')
  })

  it("コードブロックがない場合はtrimして返す", () => {
    const input = '  {"key": "value"}  '
    expect(stripCodeBlock(input)).toBe('{"key": "value"}')
  })

  it("前後の空白を除去する", () => {
    const input = "  hello  "
    expect(stripCodeBlock(input)).toBe("hello")
  })

  it("コードブロック内の空白もtrimする", () => {
    const input = "```json\n  { }\n  ```"
    expect(stripCodeBlock(input)).toBe("{ }")
  })
})

describe("parseLLMJson", () => {
  const schema = z.object({
    name: z.string(),
    count: z.number(),
  })
  const fallback = { name: "default", count: 0 }

  it("有効なJSONをパースできる", () => {
    const result = parseLLMJson('{"name": "test", "count": 5}', schema, fallback)
    expect(result).toEqual({ name: "test", count: 5 })
  })

  it("コードブロック内のJSONをパースできる", () => {
    const input = '```json\n{"name": "test", "count": 10}\n```'
    const result = parseLLMJson(input, schema, fallback)
    expect(result).toEqual({ name: "test", count: 10 })
  })

  it("スキーマに合わないデータの場合fallbackを返す", () => {
    const result = parseLLMJson('{"name": 123}', schema, fallback)
    expect(result).toEqual(fallback)
  })

  it("不正なJSONの場合fallbackを返す", () => {
    const result = parseLLMJson("not json", schema, fallback)
    expect(result).toEqual(fallback)
  })

  it("空文字の場合fallbackを返す", () => {
    const result = parseLLMJson("", schema, fallback)
    expect(result).toEqual(fallback)
  })

  it("余分なフィールドがあっても有効なデータを返す", () => {
    const result = parseLLMJson(
      '{"name": "test", "count": 1, "extra": true}',
      schema,
      fallback
    )
    expect(result.name).toBe("test")
    expect(result.count).toBe(1)
  })
})
