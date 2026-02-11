import { describe, it, expect } from "vitest"
import {
  bookmarkTargetTypeSchema,
  addBookmarkRequestSchema,
  bookmarkResponseSchema,
  bookmarkWithDetailsSchema,
  bookmarkListResponseSchema,
  deleteBookmarkParamsSchema,
} from "./bookmark"

describe("bookmarkTargetTypeSchema", () => {
  it("有効な値をパースできる", () => {
    expect(bookmarkTargetTypeSchema.safeParse("subject").success).toBe(true)
    expect(bookmarkTargetTypeSchema.safeParse("category").success).toBe(true)
    expect(bookmarkTargetTypeSchema.safeParse("topic").success).toBe(true)
  })

  it("無効な値でエラー", () => {
    expect(bookmarkTargetTypeSchema.safeParse("domain").success).toBe(false)
  })
})

describe("addBookmarkRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = addBookmarkRequestSchema.safeParse({
      targetType: "topic",
      targetId: "topic-1",
    })
    expect(result.success).toBe(true)
  })

  it("targetIdが空文字でエラー", () => {
    const result = addBookmarkRequestSchema.safeParse({
      targetType: "topic",
      targetId: "",
    })
    expect(result.success).toBe(false)
  })

  it("必須フィールド欠落でエラー", () => {
    const result = addBookmarkRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("bookmarkResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = bookmarkResponseSchema.safeParse({
      id: "bm-1",
      userId: "user-1",
      targetType: "subject",
      targetId: "sub-1",
      createdAt: "2025-01-01T00:00:00Z",
    })
    expect(result.success).toBe(true)
  })
})

describe("bookmarkWithDetailsSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = bookmarkWithDetailsSchema.safeParse({
      id: "bm-1",
      targetType: "topic",
      targetId: "topic-1",
      name: "論点名",
      path: "科目名 > 中単元名",
      domainId: "domain-1",
      subjectId: "sub-1",
      categoryId: "cat-1",
      createdAt: "2025-01-01T00:00:00Z",
    })
    expect(result.success).toBe(true)
  })

  it("subjectIdとcategoryIdがnullでも有効", () => {
    const result = bookmarkWithDetailsSchema.safeParse({
      id: "bm-1",
      targetType: "subject",
      targetId: "sub-1",
      name: "科目名",
      path: "科目名",
      domainId: "domain-1",
      subjectId: null,
      categoryId: null,
      createdAt: "2025-01-01T00:00:00Z",
    })
    expect(result.success).toBe(true)
  })
})

describe("bookmarkListResponseSchema", () => {
  it("空配列でも有効", () => {
    const result = bookmarkListResponseSchema.safeParse({ bookmarks: [] })
    expect(result.success).toBe(true)
  })
})

describe("deleteBookmarkParamsSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = deleteBookmarkParamsSchema.safeParse({
      targetType: "category",
      targetId: "cat-1",
    })
    expect(result.success).toBe(true)
  })
})
