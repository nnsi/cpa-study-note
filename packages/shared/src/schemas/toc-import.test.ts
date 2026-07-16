import { describe, expect, it } from "vitest"
import { tocSuggestRequestSchema, tocSuggestionSchema } from "./toc-import"

describe("tocSuggestRequestSchema", () => {
  it("1〜5件の画像IDを受け入れる", () => {
    expect(tocSuggestRequestSchema.safeParse({ imageIds: ["image-1"] }).success).toBe(true)
    expect(
      tocSuggestRequestSchema.safeParse({
        imageIds: ["image-1", "image-2", "image-3", "image-4", "image-5"],
      }).success
    ).toBe(true)
  })

  it("画像IDが0件の場合は拒否する", () => {
    expect(tocSuggestRequestSchema.safeParse({ imageIds: [] }).success).toBe(false)
  })

  it("画像IDが6件の場合は拒否する", () => {
    expect(
      tocSuggestRequestSchema.safeParse({
        imageIds: ["1", "2", "3", "4", "5", "6"],
      }).success
    ).toBe(false)
  })

  it("空の画像IDを拒否する", () => {
    expect(tocSuggestRequestSchema.safeParse({ imageIds: [""] }).success).toBe(false)
  })
})

describe("tocSuggestionSchema", () => {
  const validSuggestion = {
    categories: [
      {
        name: "企業会計の基礎",
        subcategories: [
          {
            name: "財務諸表",
            topics: [{ name: "貸借対照表" }, { name: "損益計算書" }],
          },
        ],
      },
    ],
  }

  it("3階層の提案を受け入れる", () => {
    expect(tocSuggestionSchema.safeParse(validSuggestion).success).toBe(true)
  })

  it("空の配列を含む提案を受け入れる", () => {
    expect(tocSuggestionSchema.safeParse({ categories: [] }).success).toBe(true)
    expect(
      tocSuggestionSchema.safeParse({
        categories: [{ name: "カテゴリ", subcategories: [] }],
      }).success
    ).toBe(true)
  })

  it("空の名前を拒否する", () => {
    expect(
      tocSuggestionSchema.safeParse({
        categories: [{ name: "", subcategories: [] }],
      }).success
    ).toBe(false)
  })

  it("200文字を超える名前を拒否する", () => {
    expect(
      tocSuggestionSchema.safeParse({
        categories: [{ name: "a".repeat(201), subcategories: [] }],
      }).success
    ).toBe(false)
  })

  it("subcategoriesがない提案を拒否する", () => {
    expect(tocSuggestionSchema.safeParse({ categories: [{ name: "カテゴリ" }] }).success).toBe(
      false
    )
  })
})
