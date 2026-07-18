import { describe, it, expect } from "vitest"
import {
  topicNodeSchema,
  subcategoryNodeSchema,
  categoryNodeSchema,
  updateTreeRequestSchema,
} from "./tree"

const makeTopic = (i: number) => ({
  id: null,
  name: `topic-${i}`,
  displayOrder: i,
})

const makeSubcategory = (i: number, topicCount = 0) => ({
  id: null,
  name: `subcat-${i}`,
  displayOrder: i,
  topics: Array.from({ length: topicCount }, (_, j) => makeTopic(j)),
})

const makeCategory = (i: number, subcatCount = 0) => ({
  id: null,
  name: `cat-${i}`,
  displayOrder: i,
  subcategories: Array.from({ length: subcatCount }, (_, j) => makeSubcategory(j)),
})

describe("topicNodeSchema", () => {
  it("自由記述のtopicTypeを受理する", () => {
    const result = topicNodeSchema.safeParse({
      id: null,
      name: "論点",
      topicType: "計算",
      displayOrder: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe("subcategoryNodeSchema topics上限", () => {
  it("500件までは許可される", () => {
    const result = subcategoryNodeSchema.safeParse(makeSubcategory(0, 500))
    expect(result.success).toBe(true)
  })

  it("501件でエラー", () => {
    const result = subcategoryNodeSchema.safeParse(makeSubcategory(0, 501))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("論点は")
    }
  })
})

describe("categoryNodeSchema subcategories上限", () => {
  it("100件までは許可される", () => {
    const result = categoryNodeSchema.safeParse(makeCategory(0, 100))
    expect(result.success).toBe(true)
  })

  it("101件でエラー", () => {
    const result = categoryNodeSchema.safeParse(makeCategory(0, 101))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("サブカテゴリは")
    }
  })
})

describe("updateTreeRequestSchema categories上限", () => {
  it("100件までは許可される", () => {
    const categories = Array.from({ length: 100 }, (_, i) => makeCategory(i))
    const result = updateTreeRequestSchema.safeParse({ categories })
    expect(result.success).toBe(true)
  })

  it("101件でエラー", () => {
    const categories = Array.from({ length: 101 }, (_, i) => makeCategory(i))
    const result = updateTreeRequestSchema.safeParse({ categories })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("カテゴリは")
    }
  })
})
