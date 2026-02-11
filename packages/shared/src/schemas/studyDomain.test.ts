import { describe, it, expect } from "vitest"
import {
  studyDomainSchema,
  createStudyDomainRequestSchema,
  updateStudyDomainRequestSchema,
  studyDomainResponseSchema,
  studyDomainListResponseSchema,
  studyDomainSingleResponseSchema,
  bulkCSVImportResponseSchema,
} from "./studyDomain"

const validDomain = {
  id: "domain-1",
  userId: "user-1",
  name: "公認会計士試験",
  description: "CPA試験の学習",
  emoji: "📚",
  color: "#3B82F6",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  deletedAt: null,
}

describe("studyDomainSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = studyDomainSchema.safeParse(validDomain)
    expect(result.success).toBe(true)
  })

  it("nullableフィールドがnullでも有効", () => {
    const result = studyDomainSchema.safeParse({
      ...validDomain,
      description: null,
      emoji: null,
      color: null,
    })
    expect(result.success).toBe(true)
  })

  it("必須フィールド欠落でエラー", () => {
    const result = studyDomainSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("createStudyDomainRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = createStudyDomainRequestSchema.safeParse({
      name: "新しい学習領域",
    })
    expect(result.success).toBe(true)
  })

  it("nameが空文字でエラー", () => {
    const result = createStudyDomainRequestSchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })

  it("nameが100文字超でエラー", () => {
    const result = createStudyDomainRequestSchema.safeParse({
      name: "a".repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it("descriptionが500文字超でエラー", () => {
    const result = createStudyDomainRequestSchema.safeParse({
      name: "テスト",
      description: "a".repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it("optionalフィールドを含められる", () => {
    const result = createStudyDomainRequestSchema.safeParse({
      name: "テスト",
      description: "説明",
      emoji: "📖",
      color: "blue",
    })
    expect(result.success).toBe(true)
  })
})

describe("updateStudyDomainRequestSchema", () => {
  it("全フィールド省略でも有効", () => {
    const result = updateStudyDomainRequestSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("nullableフィールドにnullを設定できる", () => {
    const result = updateStudyDomainRequestSchema.safeParse({
      description: null,
      emoji: null,
      color: null,
    })
    expect(result.success).toBe(true)
  })

  it("nameが空文字でエラー", () => {
    const result = updateStudyDomainRequestSchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })
})

describe("studyDomainResponseSchema", () => {
  it("deletedAtを除外したデータをパースできる", () => {
    const { deletedAt, ...withoutDeletedAt } = validDomain
    const result = studyDomainResponseSchema.safeParse(withoutDeletedAt)
    expect(result.success).toBe(true)
  })
})

describe("studyDomainListResponseSchema", () => {
  it("空配列でも有効", () => {
    const result = studyDomainListResponseSchema.safeParse({ studyDomains: [] })
    expect(result.success).toBe(true)
  })
})

describe("studyDomainSingleResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const { deletedAt, ...domainResponse } = validDomain
    const result = studyDomainSingleResponseSchema.safeParse({
      studyDomain: domainResponse,
    })
    expect(result.success).toBe(true)
  })
})

describe("bulkCSVImportResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = bulkCSVImportResponseSchema.safeParse({
      success: true,
      imported: {
        subjects: 3,
        categories: 10,
        subcategories: 20,
        topics: 50,
      },
      errors: [],
    })
    expect(result.success).toBe(true)
  })

  it("エラー付きのレスポンスもパースできる", () => {
    const result = bulkCSVImportResponseSchema.safeParse({
      success: false,
      imported: { subjects: 0, categories: 0, subcategories: 0, topics: 0 },
      errors: [
        { line: 5, message: "不正なフォーマット" },
        { line: 12, message: "重複データ" },
      ],
    })
    expect(result.success).toBe(true)
  })
})

// ===== 境界値テスト =====

describe("createStudyDomainRequestSchema - 境界値", () => {
  it("nameがちょうど100文字でOK（max境界）", () => {
    const result = createStudyDomainRequestSchema.safeParse({
      name: "a".repeat(100),
    })
    expect(result.success).toBe(true)
  })

  it("nameが1文字でOK（min境界）", () => {
    const result = createStudyDomainRequestSchema.safeParse({
      name: "a",
    })
    expect(result.success).toBe(true)
  })

  it("descriptionがちょうど500文字でOK（max境界）", () => {
    const result = createStudyDomainRequestSchema.safeParse({
      name: "テスト",
      description: "a".repeat(500),
    })
    expect(result.success).toBe(true)
  })
})
