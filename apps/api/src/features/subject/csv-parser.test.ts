import { describe, it, expect } from "vitest"
import { parseCSV, convertToTree, mergeTree } from "./csv-parser"

describe("CSV Parser", () => {
  describe("parseCSV", () => {
    it("should parse basic CSV with 3 columns", () => {
      const csv = `大単元,中単元,論点
財務会計の基礎概念,会計公準,企業実体の公準
財務会計の基礎概念,会計公準,継続企業の公準`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(0)
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0]).toEqual({
        largeCategory: "財務会計の基礎概念",
        mediumCategory: "会計公準",
        topic: "企業実体の公準",
      })
    })

    it("should skip header row", () => {
      const csv = `大単元,中単元,論点
カテゴリ,サブカテゴリ,トピック`

      const result = parseCSV(csv)

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].largeCategory).toBe("カテゴリ")
    })

    it("should skip empty lines", () => {
      const csv = `大単元,中単元,論点

カテゴリ1,サブカテゴリ1,トピック1

カテゴリ2,サブカテゴリ2,トピック2
`

      const result = parseCSV(csv)

      expect(result.rows).toHaveLength(2)
    })

    it("should handle quoted fields with comma", () => {
      const csv = `大単元,中単元,論点
"カンマ,を含む単元",サブカテゴリ,トピック`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].largeCategory).toBe("カンマ,を含む単元")
    })

    it("should handle escaped double quotes", () => {
      const csv = `大単元,中単元,論点
"引用符""を含む",サブカテゴリ,トピック`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].largeCategory).toBe('引用符"を含む')
    })

    it("should handle newline within quoted field", () => {
      const csv = `大単元,中単元,論点
"複数行
の単元",サブカテゴリ,トピック`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].largeCategory).toBe("複数行\nの単元")
    })

    it("should report error for insufficient columns", () => {
      const csv = `大単元,中単元,論点
カテゴリ,サブカテゴリ`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].line).toBe(2)
      expect(result.errors[0].message).toContain("3列")
    })

    it("should report error for empty fields", () => {
      const csv = `大単元,中単元,論点
カテゴリ,,トピック`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].line).toBe(2)
      expect(result.errors[0].message).toContain("空")
    })

    it("should continue parsing after errors", () => {
      const csv = `大単元,中単元,論点
カテゴリ1,サブカテゴリ1
カテゴリ2,サブカテゴリ2,トピック2`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(1)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].largeCategory).toBe("カテゴリ2")
    })

    it("should handle CRLF line endings", () => {
      const csv = "大単元,中単元,論点\r\nカテゴリ,サブカテゴリ,トピック\r\n"

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(0)
      expect(result.rows).toHaveLength(1)
    })

    it("should trim whitespace from fields", () => {
      const csv = `大単元,中単元,論点
 カテゴリ , サブカテゴリ , トピック `

      const result = parseCSV(csv)

      expect(result.rows[0].largeCategory).toBe("カテゴリ")
      expect(result.rows[0].mediumCategory).toBe("サブカテゴリ")
      expect(result.rows[0].topic).toBe("トピック")
    })
  })

  describe("convertToTree", () => {
    it("should convert rows to tree structure", () => {
      const rows = [
        { largeCategory: "カテゴリ1", mediumCategory: "サブカテゴリ1", topic: "トピック1" },
        { largeCategory: "カテゴリ1", mediumCategory: "サブカテゴリ1", topic: "トピック2" },
        { largeCategory: "カテゴリ1", mediumCategory: "サブカテゴリ2", topic: "トピック3" },
      ]

      const tree = convertToTree(rows)

      expect(tree.categories).toHaveLength(1)
      expect(tree.categories[0].name).toBe("カテゴリ1")
      expect(tree.categories[0].subcategories).toHaveLength(2)
      expect(tree.categories[0].subcategories[0].topics).toHaveLength(2)
    })

    it("should handle multiple categories", () => {
      const rows = [
        { largeCategory: "カテゴリ1", mediumCategory: "サブカテゴリ1", topic: "トピック1" },
        { largeCategory: "カテゴリ2", mediumCategory: "サブカテゴリ2", topic: "トピック2" },
      ]

      const tree = convertToTree(rows)

      expect(tree.categories).toHaveLength(2)
      expect(tree.categories[0].name).toBe("カテゴリ1")
      expect(tree.categories[1].name).toBe("カテゴリ2")
    })

    it("should deduplicate topics within same subcategory", () => {
      const rows = [
        { largeCategory: "カテゴリ1", mediumCategory: "サブカテゴリ1", topic: "トピック1" },
        { largeCategory: "カテゴリ1", mediumCategory: "サブカテゴリ1", topic: "トピック1" }, // Duplicate
      ]

      const tree = convertToTree(rows)

      expect(tree.categories[0].subcategories[0].topics).toHaveLength(1)
    })

    it("should assign display orders starting from 0", () => {
      const rows = [
        { largeCategory: "カテゴリ1", mediumCategory: "サブカテゴリ1", topic: "トピック1" },
        { largeCategory: "カテゴリ2", mediumCategory: "サブカテゴリ2", topic: "トピック2" },
      ]

      const tree = convertToTree(rows)

      expect(tree.categories[0].displayOrder).toBe(0)
      expect(tree.categories[1].displayOrder).toBe(1)
    })

    it("should set all IDs to null (new nodes)", () => {
      const rows = [
        { largeCategory: "カテゴリ1", mediumCategory: "サブカテゴリ1", topic: "トピック1" },
      ]

      const tree = convertToTree(rows)

      expect(tree.categories[0].id).toBeNull()
      expect(tree.categories[0].subcategories[0].id).toBeNull()
      expect(tree.categories[0].subcategories[0].topics[0].id).toBeNull()
    })
  })

  describe("mergeTree", () => {
    it("should merge new category into existing tree", () => {
      const existing = {
        categories: [
          {
            id: "cat-1",
            name: "既存カテゴリ",
            displayOrder: 0,
            subcategories: [],
          },
        ],
      }

      const imported = {
        categories: [
          {
            id: null,
            name: "新規カテゴリ",
            displayOrder: 0,
            subcategories: [],
          },
        ],
      }

      const merged = mergeTree(existing, imported)

      expect(merged.categories).toHaveLength(2)
      expect(merged.categories[0].id).toBe("cat-1")
      expect(merged.categories[1].id).toBeNull()
    })

    it("should merge subcategories into same category name", () => {
      const existing = {
        categories: [
          {
            id: "cat-1",
            name: "カテゴリ",
            displayOrder: 0,
            subcategories: [
              {
                id: "subcat-1",
                name: "既存サブカテゴリ",
                displayOrder: 0,
                topics: [],
              },
            ],
          },
        ],
      }

      const imported = {
        categories: [
          {
            id: null,
            name: "カテゴリ", // Same name
            displayOrder: 0,
            subcategories: [
              {
                id: null,
                name: "新規サブカテゴリ",
                displayOrder: 0,
                topics: [],
              },
            ],
          },
        ],
      }

      const merged = mergeTree(existing, imported)

      expect(merged.categories).toHaveLength(1)
      expect(merged.categories[0].id).toBe("cat-1") // Preserves existing ID
      expect(merged.categories[0].subcategories).toHaveLength(2)
    })

    it("should merge topics into same subcategory name", () => {
      const existing = {
        categories: [
          {
            id: "cat-1",
            name: "カテゴリ",
            displayOrder: 0,
            subcategories: [
              {
                id: "subcat-1",
                name: "サブカテゴリ",
                displayOrder: 0,
                topics: [
                  { id: "topic-1", name: "既存トピック", displayOrder: 0 },
                ],
              },
            ],
          },
        ],
      }

      const imported = {
        categories: [
          {
            id: null,
            name: "カテゴリ",
            displayOrder: 0,
            subcategories: [
              {
                id: null,
                name: "サブカテゴリ", // Same name
                displayOrder: 0,
                topics: [
                  { id: null, name: "新規トピック", displayOrder: 0 },
                ],
              },
            ],
          },
        ],
      }

      const merged = mergeTree(existing, imported)

      expect(merged.categories[0].subcategories[0].topics).toHaveLength(2)
      expect(merged.categories[0].subcategories[0].topics[0].id).toBe("topic-1")
      expect(merged.categories[0].subcategories[0].topics[1].id).toBeNull()
    })

    it("should not duplicate existing topics with same name", () => {
      const existing = {
        categories: [
          {
            id: "cat-1",
            name: "カテゴリ",
            displayOrder: 0,
            subcategories: [
              {
                id: "subcat-1",
                name: "サブカテゴリ",
                displayOrder: 0,
                topics: [
                  { id: "topic-1", name: "トピック", displayOrder: 0 },
                ],
              },
            ],
          },
        ],
      }

      const imported = {
        categories: [
          {
            id: null,
            name: "カテゴリ",
            displayOrder: 0,
            subcategories: [
              {
                id: null,
                name: "サブカテゴリ",
                displayOrder: 0,
                topics: [
                  { id: null, name: "トピック", displayOrder: 0 }, // Same name
                ],
              },
            ],
          },
        ],
      }

      const merged = mergeTree(existing, imported)

      expect(merged.categories[0].subcategories[0].topics).toHaveLength(1)
      expect(merged.categories[0].subcategories[0].topics[0].id).toBe("topic-1") // Preserves existing
    })

    it("should preserve display order and sort correctly", () => {
      const existing = {
        categories: [
          {
            id: "cat-1",
            name: "カテゴリ1",
            displayOrder: 0,
            subcategories: [],
          },
        ],
      }

      const imported = {
        categories: [
          {
            id: null,
            name: "カテゴリ2",
            displayOrder: 0,
            subcategories: [],
          },
        ],
      }

      const merged = mergeTree(existing, imported)

      expect(merged.categories[0].displayOrder).toBe(0)
      expect(merged.categories[1].displayOrder).toBe(1)
    })
  })
})
