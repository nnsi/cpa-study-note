import { describe, it, expect, beforeEach } from "vitest"
import { getSubjectTree, updateSubjectTree as _updateSubjectTree } from "./tree"
import { createTestDatabase, type TestDatabase } from "@/test/mocks/db"
import {
  createTestUser,
  createTestStudyDomain,
  createTestSubject,
  createTestCategory,
  createTestTopic,
} from "@/test/helpers"
import * as schema from "@cpa-study/db/schema"
import { eq } from "drizzle-orm"
import { createMockSimpleTransactionRunner } from "@/shared/lib/transaction"
import type { UpdateTreeRequest } from "@cpa-study/shared/schemas"

describe("Tree Operations", () => {
  let db: TestDatabase
  // Wrapper for updateSubjectTree that injects the mock transaction runner
  let updateSubjectTree: (
    db: TestDatabase,
    userId: string,
    subjectId: string,
    tree: UpdateTreeRequest
  ) => ReturnType<typeof _updateSubjectTree>

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    // Use mock transaction runner for better-sqlite3 (which doesn't support async transactions)
    const txRunner = createMockSimpleTransactionRunner(db)
    updateSubjectTree = (db, userId, subjectId, tree) =>
      _updateSubjectTree(db, userId, subjectId, tree, txRunner)
  })

  describe("getSubjectTree", () => {
    it("should return empty tree for subject with no categories", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const result = await getSubjectTree(db, userId, subjectId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.categories).toHaveLength(0)
      }
    })

    it("should return tree with categories and topics", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: cat1Id } = createTestCategory(db, userId, subjectId, { name: "Category 1", depth: 1 })
      const { id: subcat1Id } = createTestCategory(db, userId, subjectId, {
        name: "Subcategory 1",
        depth: 2,
        parentId: cat1Id,
      })
      createTestTopic(db, userId, subcat1Id, { name: "Topic 1" })
      createTestTopic(db, userId, subcat1Id, { name: "Topic 2" })

      const result = await getSubjectTree(db, userId, subjectId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.categories).toHaveLength(1)
        expect(result.value.categories[0].name).toBe("Category 1")
        expect(result.value.categories[0].subcategories).toHaveLength(1)
        expect(result.value.categories[0].subcategories[0].name).toBe("Subcategory 1")
        expect(result.value.categories[0].subcategories[0].topics).toHaveLength(2)
      }
    })

    it("should not return soft-deleted categories", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      createTestCategory(db, userId, subjectId, { name: "Active", depth: 1 })
      createTestCategory(db, userId, subjectId, { name: "Deleted", depth: 1, deletedAt: new Date() })

      const result = await getSubjectTree(db, userId, subjectId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.categories).toHaveLength(1)
        expect(result.value.categories[0].name).toBe("Active")
      }
    })

    it("should not return soft-deleted topics", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, { name: "Category", depth: 1 })
      const { id: subcatId } = createTestCategory(db, userId, subjectId, {
        name: "Subcategory",
        depth: 2,
        parentId: catId,
      })
      createTestTopic(db, userId, subcatId, { name: "Active" })
      createTestTopic(db, userId, subcatId, { name: "Deleted", deletedAt: new Date() })

      const result = await getSubjectTree(db, userId, subjectId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.categories[0].subcategories[0].topics).toHaveLength(1)
        expect(result.value.categories[0].subcategories[0].topics[0].name).toBe("Active")
      }
    })

    it("should return NOT_FOUND for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)

      const result = await getSubjectTree(db, userId, "non-existent")

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

      const result = await getSubjectTree(db, user2Id, subjectId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })
  })

  describe("updateSubjectTree", () => {
    it("should create new categories and topics", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const result = await updateSubjectTree(db, userId, subjectId, {
        categories: [
          {
            id: null,
            name: "New Category",
            displayOrder: 0,
            subcategories: [
              {
                id: null,
                name: "New Subcategory",
                displayOrder: 0,
                topics: [
                  {
                    id: null,
                    name: "New Topic",
                    displayOrder: 0,
                  },
                ],
              },
            ],
          },
        ],
      })

      expect(result.ok).toBe(true)

      // Verify tree was created
      const tree = await getSubjectTree(db, userId, subjectId)
      expect(tree.ok).toBe(true)
      if (tree.ok) {
        expect(tree.value.categories).toHaveLength(1)
        expect(tree.value.categories[0].name).toBe("New Category")
        expect(tree.value.categories[0].subcategories[0].name).toBe("New Subcategory")
        expect(tree.value.categories[0].subcategories[0].topics[0].name).toBe("New Topic")
      }
    })

    it("should update existing categories", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, { name: "Original", depth: 1 })

      const result = await updateSubjectTree(db, userId, subjectId, {
        categories: [
          {
            id: catId,
            name: "Updated",
            displayOrder: 0,
            subcategories: [],
          },
        ],
      })

      expect(result.ok).toBe(true)

      const tree = await getSubjectTree(db, userId, subjectId)
      expect(tree.ok).toBe(true)
      if (tree.ok) {
        expect(tree.value.categories[0].name).toBe("Updated")
        expect(tree.value.categories[0].id).toBe(catId)
      }
    })

    it("should soft-delete nodes not in request", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, { name: "ToDelete", depth: 1 })

      const result = await updateSubjectTree(db, userId, subjectId, {
        categories: [], // Empty tree
      })

      expect(result.ok).toBe(true)

      // Verify it's soft-deleted
      const deleted = db.select().from(schema.categories).where(eq(schema.categories.id, catId)).all()
      expect(deleted[0].deletedAt).not.toBeNull()
    })

    it("should revive soft-deleted nodes if id is provided", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, {
        name: "Deleted",
        depth: 1,
        deletedAt: new Date(),
      })

      const result = await updateSubjectTree(db, userId, subjectId, {
        categories: [
          {
            id: catId,
            name: "Revived",
            displayOrder: 0,
            subcategories: [],
          },
        ],
      })

      expect(result.ok).toBe(true)

      // Verify it's revived
      const revived = db.select().from(schema.categories).where(eq(schema.categories.id, catId)).all()
      expect(revived[0].deletedAt).toBeNull()
      expect(revived[0].name).toBe("Revived")
    })

    it("should return INVALID_ID for another user's category ID", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domain1Id } = createTestStudyDomain(db, user1Id)
      const { id: domain2Id } = createTestStudyDomain(db, user2Id)
      const { id: subject1Id } = createTestSubject(db, user1Id, domain1Id)
      const { id: subject2Id } = createTestSubject(db, user2Id, domain2Id)
      const { id: cat2Id } = createTestCategory(db, user2Id, subject2Id, { name: "User2 Category", depth: 1 })

      // User1 tries to use User2's category ID
      const result = await updateSubjectTree(db, user1Id, subject1Id, {
        categories: [
          {
            id: cat2Id, // User2's category
            name: "Hijacked",
            displayOrder: 0,
            subcategories: [],
          },
        ],
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("INVALID_ID")
      }
    })

    it("should return INVALID_ID for category from different subject", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subject1Id } = createTestSubject(db, userId, domainId, { name: "Subject 1" })
      const { id: subject2Id } = createTestSubject(db, userId, domainId, { name: "Subject 2" })
      const { id: cat2Id } = createTestCategory(db, userId, subject2Id, { name: "Subject2 Category", depth: 1 })

      // Try to use subject2's category in subject1's tree
      const result = await updateSubjectTree(db, userId, subject1Id, {
        categories: [
          {
            id: cat2Id, // Different subject's category
            name: "Wrong Subject",
            displayOrder: 0,
            subcategories: [],
          },
        ],
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("INVALID_ID")
      }
    })

    it("should return INVALID_ID for another user's topic ID", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domain1Id } = createTestStudyDomain(db, user1Id)
      const { id: domain2Id } = createTestStudyDomain(db, user2Id)
      const { id: subject1Id } = createTestSubject(db, user1Id, domain1Id)
      const { id: subject2Id } = createTestSubject(db, user2Id, domain2Id)
      const { id: cat2Id } = createTestCategory(db, user2Id, subject2Id, { name: "Cat", depth: 1 })
      const { id: subcat2Id } = createTestCategory(db, user2Id, subject2Id, {
        name: "Subcat",
        depth: 2,
        parentId: cat2Id,
      })
      const { id: topic2Id } = createTestTopic(db, user2Id, subcat2Id, { name: "User2 Topic" })

      // User1 tries to use User2's topic ID
      const result = await updateSubjectTree(db, user1Id, subject1Id, {
        categories: [
          {
            id: null,
            name: "Category",
            displayOrder: 0,
            subcategories: [
              {
                id: null,
                name: "Subcategory",
                displayOrder: 0,
                topics: [
                  {
                    id: topic2Id, // User2's topic
                    name: "Hijacked Topic",
                    displayOrder: 0,
                  },
                ],
              },
            ],
          },
        ],
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("INVALID_ID")
      }
    })

    it("should return NOT_FOUND for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)

      const result = await updateSubjectTree(db, userId, "non-existent", {
        categories: [],
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should update topic details", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, { name: "Category", depth: 1 })
      const { id: subcatId } = createTestCategory(db, userId, subjectId, {
        name: "Subcategory",
        depth: 2,
        parentId: catId,
      })
      const { id: topicId } = createTestTopic(db, userId, subcatId, { name: "Original Topic" })

      const result = await updateSubjectTree(db, userId, subjectId, {
        categories: [
          {
            id: catId,
            name: "Category",
            displayOrder: 0,
            subcategories: [
              {
                id: subcatId,
                name: "Subcategory",
                displayOrder: 0,
                topics: [
                  {
                    id: topicId,
                    name: "Updated Topic",
                    description: "New description",
                    difficulty: "advanced",
                    topicType: "calculation",
                    aiSystemPrompt: "Custom prompt",
                    displayOrder: 0,
                  },
                ],
              },
            ],
          },
        ],
      })

      expect(result.ok).toBe(true)

      const tree = await getSubjectTree(db, userId, subjectId)
      expect(tree.ok).toBe(true)
      if (tree.ok) {
        const topic = tree.value.categories[0].subcategories[0].topics[0]
        expect(topic.name).toBe("Updated Topic")
        expect(topic.description).toBe("New description")
        expect(topic.difficulty).toBe("advanced")
        expect(topic.topicType).toBe("calculation")
        expect(topic.aiSystemPrompt).toBe("Custom prompt")
      }
    })
  })
})
