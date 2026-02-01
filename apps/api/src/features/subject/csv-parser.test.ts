import { describe, it, expect } from "vitest"
import { parseCSV, convertToTree, mergeTree } from "./csv-parser"

describe("CSV Parser", () => {
  describe("parseCSV", () => {
    it("should parse basic CSV with 3 columns", () => {
      const csv = `科目,カテゴリ,論点
財務会計,会計公準,企業実体の公準
財務会計,会計公準,継続企業の公準`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(0)
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0]).toEqual({
        subject: "財務会計",
        category: "会計公準",
        topic: "企業実体の公準",
      })
    })

    it("should skip header row", () => {
      const csv = `科目,カテゴリ,論点
科目名,カテゴリ名,トピック名`

      const result = parseCSV(csv)

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].subject).toBe("科目名")
      expect(result.rows[0].category).toBe("カテゴリ名")
    })

    it("should skip empty lines", () => {
      const csv = `科目,カテゴリ,論点

科目1,カテゴリ1,トピック1

科目2,カテゴリ2,トピック2
`

      const result = parseCSV(csv)

      expect(result.rows).toHaveLength(2)
    })

    it("should handle quoted fields with comma", () => {
      const csv = `科目,カテゴリ,論点
"カンマ,を含む科目","カンマ,を含むカテゴリ",トピック`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].subject).toBe("カンマ,を含む科目")
      expect(result.rows[0].category).toBe("カンマ,を含むカテゴリ")
    })

    it("should handle escaped double quotes", () => {
      const csv = `科目,カテゴリ,論点
科目名,"引用符""を含む",トピック`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].category).toBe('引用符"を含む')
    })

    it("should handle newline within quoted field", () => {
      const csv = `科目,カテゴリ,論点
科目名,"複数行
のカテゴリ",トピック`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(0)
      expect(result.rows[0].category).toBe("複数行\nのカテゴリ")
    })

    it("should report error for insufficient columns", () => {
      const csv = `科目,カテゴリ,論点
科目名,カテゴリのみ`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].line).toBe(2)
      expect(result.errors[0].message).toContain("3列")
    })

    it("should report error for empty fields", () => {
      const csv = `科目,カテゴリ,論点
科目名,カテゴリ,`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].line).toBe(2)
      expect(result.errors[0].message).toContain("空")
    })

    it("should continue parsing after errors", () => {
      const csv = `科目,カテゴリ,論点
科目1,カテゴリ1
科目2,カテゴリ2,トピック2`

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(1)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].category).toBe("カテゴリ2")
    })

    it("should handle CRLF line endings", () => {
      const csv = "科目,カテゴリ,論点\r\n科目1,カテゴリ1,トピック1\r\n"

      const result = parseCSV(csv)

      expect(result.errors).toHaveLength(0)
      expect(result.rows).toHaveLength(1)
    })

    it("should trim whitespace from fields", () => {
      const csv = `科目,カテゴリ,論点
 科目 , カテゴリ , トピック `

      const result = parseCSV(csv)

      expect(result.rows[0].subject).toBe("科目")
      expect(result.rows[0].category).toBe("カテゴリ")
      expect(result.rows[0].topic).toBe("トピック")
    })
  })

  describe("convertToTree", () => {
    it("should convert rows to tree structure (subject field is ignored)", () => {
      const rows = [
        { subject: "財務会計", category: "カテゴリ1", topic: "トピック1" },
        { subject: "財務会計", category: "カテゴリ1", topic: "トピック2" },
        { subject: "財務会計", category: "カテゴリ2", topic: "トピック3" },
      ]

      const tree = convertToTree(rows)

      expect(tree.categories).toHaveLength(2)
      expect(tree.categories[0].name).toBe("カテゴリ1")
      expect(tree.categories[0].topics).toHaveLength(2)
      expect(tree.categories[1].topics).toHaveLength(1)
    })

    it("should handle multiple categories", () => {
      const rows = [
        { subject: "財務会計", category: "カテゴリ1", topic: "トピック1" },
        { subject: "財務会計", category: "カテゴリ2", topic: "トピック2" },
      ]

      const tree = convertToTree(rows)

      expect(tree.categories).toHaveLength(2)
      expect(tree.categories[0].name).toBe("カテゴリ1")
      expect(tree.categories[1].name).toBe("カテゴリ2")
    })

    it("should deduplicate topics within same category", () => {
      const rows = [
        { subject: "財務会計", category: "カテゴリ1", topic: "トピック1" },
        { subject: "財務会計", category: "カテゴリ1", topic: "トピック1" }, // Duplicate
      ]

      const tree = convertToTree(rows)

      expect(tree.categories[0].topics).toHaveLength(1)
    })

    it("should assign display orders starting from 0", () => {
      const rows = [
        { subject: "財務会計", category: "カテゴリ1", topic: "トピック1" },
        { subject: "財務会計", category: "カテゴリ2", topic: "トピック2" },
      ]

      const tree = convertToTree(rows)

      expect(tree.categories[0].displayOrder).toBe(0)
      expect(tree.categories[1].displayOrder).toBe(1)
    })

    it("should set all IDs to null (new nodes)", () => {
      const rows = [{ subject: "財務会計", category: "カテゴリ1", topic: "トピック1" }]

      const tree = convertToTree(rows)

      expect(tree.categories[0].id).toBeNull()
      expect(tree.categories[0].topics[0].id).toBeNull()
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
            topics: [],
          },
        ],
      }

      const imported = {
        categories: [
          {
            id: null,
            name: "新規カテゴリ",
            displayOrder: 0,
            topics: [],
          },
        ],
      }

      const merged = mergeTree(existing, imported)

      expect(merged.categories).toHaveLength(2)
      expect(merged.categories[0].id).toBe("cat-1")
      expect(merged.categories[1].id).toBeNull()
    })

    it("should merge topics into same category name", () => {
      const existing = {
        categories: [
          {
            id: "cat-1",
            name: "カテゴリ",
            displayOrder: 0,
            topics: [{ id: "topic-1", name: "既存トピック", displayOrder: 0 }],
          },
        ],
      }

      const imported = {
        categories: [
          {
            id: null,
            name: "カテゴリ", // Same name
            displayOrder: 0,
            topics: [{ id: null, name: "新規トピック", displayOrder: 0 }],
          },
        ],
      }

      const merged = mergeTree(existing, imported)

      expect(merged.categories).toHaveLength(1)
      expect(merged.categories[0].id).toBe("cat-1") // Preserves existing ID
      expect(merged.categories[0].topics).toHaveLength(2)
    })

    it("should not duplicate existing topics with same name", () => {
      const existing = {
        categories: [
          {
            id: "cat-1",
            name: "カテゴリ",
            displayOrder: 0,
            topics: [{ id: "topic-1", name: "トピック", displayOrder: 0 }],
          },
        ],
      }

      const imported = {
        categories: [
          {
            id: null,
            name: "カテゴリ",
            displayOrder: 0,
            topics: [{ id: null, name: "トピック", displayOrder: 0 }], // Same name
          },
        ],
      }

      const merged = mergeTree(existing, imported)

      expect(merged.categories[0].topics).toHaveLength(1)
      expect(merged.categories[0].topics[0].id).toBe("topic-1") // Preserves existing
    })

    it("should preserve display order and sort correctly", () => {
      const existing = {
        categories: [
          {
            id: "cat-1",
            name: "カテゴリ1",
            displayOrder: 0,
            topics: [],
          },
        ],
      }

      const imported = {
        categories: [
          {
            id: null,
            name: "カテゴリ2",
            displayOrder: 0,
            topics: [],
          },
        ],
      }

      const merged = mergeTree(existing, imported)

      expect(merged.categories[0].displayOrder).toBe(0)
      expect(merged.categories[1].displayOrder).toBe(1)
    })
  })
})
