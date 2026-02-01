import { describe, it, expect, beforeEach } from "vitest"
import { importCSV } from "./csv-import"
import { getSubjectTree } from "./tree"
import { createTestDatabase, type TestDatabase } from "@/test/mocks/db"
import {
  createTestUser,
  createTestStudyDomain,
  createTestSubject,
  createTestCategory,
  createTestTopic,
} from "@/test/helpers"

describe("CSV Import", () => {
  let db: TestDatabase

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
  })

  describe("importCSV", () => {
    it("should import CSV data into empty subject", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const csv = `大単元,中単元,論点
カテゴリ1,サブカテゴリ1,トピック1
カテゴリ1,サブカテゴリ1,トピック2`

      const result = await importCSV(db, userId, subjectId, csv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.success).toBe(true)
        expect(result.value.imported.categories).toBe(1)
        expect(result.value.imported.subcategories).toBe(1)
        expect(result.value.imported.topics).toBe(2)
      }

      // Verify tree was created
      const tree = await getSubjectTree(db, userId, subjectId)
      expect(tree.ok).toBe(true)
      if (tree.ok) {
        expect(tree.value.categories).toHaveLength(1)
        expect(tree.value.categories[0].subcategories[0].topics).toHaveLength(2)
      }
    })

    it("should merge with existing categories", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, { name: "カテゴリ1", depth: 1 })
      const { id: subcatId } = createTestCategory(db, userId, subjectId, {
        name: "サブカテゴリ1",
        depth: 2,
        parentId: catId,
      })
      createTestTopic(db, userId, subcatId, { name: "既存トピック" })

      const csv = `大単元,中単元,論点
カテゴリ1,サブカテゴリ1,新規トピック`

      const result = await importCSV(db, userId, subjectId, csv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.success).toBe(true)
      }

      // Verify merged tree
      const tree = await getSubjectTree(db, userId, subjectId)
      expect(tree.ok).toBe(true)
      if (tree.ok) {
        expect(tree.value.categories).toHaveLength(1)
        expect(tree.value.categories[0].subcategories[0].topics).toHaveLength(2)
      }
    })

    it("should add new category to existing tree", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, { name: "既存カテゴリ", depth: 1 })
      const { id: subcatId } = createTestCategory(db, userId, subjectId, {
        name: "既存サブカテゴリ",
        depth: 2,
        parentId: catId,
      })
      createTestTopic(db, userId, subcatId, { name: "既存トピック" })

      const csv = `大単元,中単元,論点
新規カテゴリ,新規サブカテゴリ,新規トピック`

      const result = await importCSV(db, userId, subjectId, csv)

      expect(result.ok).toBe(true)

      // Verify both categories exist
      const tree = await getSubjectTree(db, userId, subjectId)
      expect(tree.ok).toBe(true)
      if (tree.ok) {
        expect(tree.value.categories).toHaveLength(2)
      }
    })

    it("should return NOT_FOUND for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)

      const csv = `大単元,中単元,論点
カテゴリ,サブカテゴリ,トピック`

      const result = await importCSV(db, userId, "non-existent", csv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return NOT_FOUND for other user's subject", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const csv = `大単元,中単元,論点
カテゴリ,サブカテゴリ,トピック`

      const result = await importCSV(db, user2Id, subjectId, csv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return success=false with errors for empty CSV", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const csv = `大単元,中単元,論点
`

      const result = await importCSV(db, userId, subjectId, csv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.success).toBe(false)
        expect(result.value.errors).toHaveLength(1)
        expect(result.value.errors[0].message).toContain("インポートするデータがありません")
      }
    })

    it("should return partial success with parse errors", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const csv = `大単元,中単元,論点
カテゴリ1,サブカテゴリ1,トピック1
カテゴリ2,サブカテゴリ2
カテゴリ3,サブカテゴリ3,トピック3`

      const result = await importCSV(db, userId, subjectId, csv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.success).toBe(true)
        expect(result.value.imported.topics).toBe(2)
        expect(result.value.errors).toHaveLength(1)
        expect(result.value.errors[0].line).toBe(3)
      }
    })

    it("should handle Japanese content correctly", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const csv = `大単元,中単元,論点
財務会計の基礎概念,会計公準,企業実体の公準
財務会計の基礎概念,会計公準,継続企業の公準
財務会計の基礎概念,会計公準,貨幣的測定の公準`

      const result = await importCSV(db, userId, subjectId, csv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.success).toBe(true)
        expect(result.value.imported.topics).toBe(3)
      }

      // Verify content
      const tree = await getSubjectTree(db, userId, subjectId)
      expect(tree.ok).toBe(true)
      if (tree.ok) {
        expect(tree.value.categories[0].name).toBe("財務会計の基礎概念")
      }
    })

    it("should not duplicate existing topics on re-import", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const csv = `大単元,中単元,論点
カテゴリ,サブカテゴリ,トピック`

      // Import twice
      await importCSV(db, userId, subjectId, csv)
      await importCSV(db, userId, subjectId, csv)

      // Verify no duplicates
      const tree = await getSubjectTree(db, userId, subjectId)
      expect(tree.ok).toBe(true)
      if (tree.ok) {
        expect(tree.value.categories[0].subcategories[0].topics).toHaveLength(1)
      }
    })
  })
})
