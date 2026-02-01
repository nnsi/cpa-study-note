import { describe, it, expect, beforeEach } from "vitest"
import { createSubjectRepository, type SubjectRepository } from "./repository"
import {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectTree,
  updateSubjectTree,
  importCSVToSubject,
  type SubjectUseCaseDeps,
  type TreeUseCaseDeps,
} from "./usecase"
import { createTestDatabase, type TestDatabase } from "@/test/mocks/db"
import { createTestUser, createTestStudyDomain, createTestSubject, createTestCategory, createTestTopic } from "@/test/helpers"
import { createMockSimpleTransactionRunner } from "@/shared/lib/transaction"
import * as schema from "@cpa-study/db/schema"
import { eq } from "drizzle-orm"
import type { UpdateTreeRequest } from "@cpa-study/shared/schemas"

describe("Subject UseCase", () => {
  let db: TestDatabase
  let deps: SubjectUseCaseDeps

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    deps = {
      subjectRepo: createSubjectRepository(db),
    }
  })

  describe("listSubjects", () => {
    it("should return subjects for the user's study domain", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      createTestSubject(db, userId, domainId, { name: "Subject 1" })
      createTestSubject(db, userId, domainId, { name: "Subject 2" })

      const result = await listSubjects(deps, userId, domainId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(2)
      }
    })

    it("should return NOT_FOUND if study domain does not belong to user", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)

      const result = await listSubjects(deps, user2Id, domainId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return NOT_FOUND if study domain is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId, { deletedAt: new Date() })

      const result = await listSubjects(deps, userId, domainId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return empty array if no subjects exist", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)

      const result = await listSubjects(deps, userId, domainId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(0)
      }
    })
  })

  describe("getSubject", () => {
    it("should return subject if owned by user", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { name: "My Subject" })

      const result = await getSubject(deps, userId, subjectId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe("My Subject")
      }
    })

    it("should return NOT_FOUND if subject does not exist", async () => {
      const { id: userId } = createTestUser(db)

      const result = await getSubject(deps, userId, "non-existent-id")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return NOT_FOUND if subject belongs to different user", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const result = await getSubject(deps, user2Id, subjectId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return NOT_FOUND if subject is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { deletedAt: new Date() })

      const result = await getSubject(deps, userId, subjectId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return NOT_FOUND if parent domain is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId, { deletedAt: new Date() })
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const result = await getSubject(deps, userId, subjectId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })
  })

  describe("createSubject", () => {
    it("should create a new subject", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)

      const result = await createSubject(deps, userId, {
        studyDomainId: domainId,
        name: "New Subject",
        description: "Description",
        emoji: "📚",
        color: "blue",
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.id).toBeDefined()

        // Verify it was created
        const getResult = await getSubject(deps, userId, result.value.id)
        expect(getResult.ok).toBe(true)
        if (getResult.ok) {
          expect(getResult.value.name).toBe("New Subject")
        }
      }
    })

    it("should return NOT_FOUND if study domain does not belong to user", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)

      const result = await createSubject(deps, user2Id, {
        studyDomainId: domainId,
        name: "Hijacked Subject",
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return NOT_FOUND if study domain is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId, { deletedAt: new Date() })

      const result = await createSubject(deps, userId, {
        studyDomainId: domainId,
        name: "Subject in Deleted Domain",
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })
  })

  describe("updateSubject", () => {
    it("should update an existing subject", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { name: "Original" })

      const result = await updateSubject(deps, userId, subjectId, {
        name: "Updated",
        description: "New Description",
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe("Updated")
        expect(result.value.description).toBe("New Description")
      }
    })

    it("should return NOT_FOUND if subject does not exist", async () => {
      const { id: userId } = createTestUser(db)

      const result = await updateSubject(deps, userId, "non-existent-id", { name: "Updated" })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return NOT_FOUND if subject belongs to different user", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const result = await updateSubject(deps, user2Id, subjectId, { name: "Hijacked" })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return NOT_FOUND if subject is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { deletedAt: new Date() })

      const result = await updateSubject(deps, userId, subjectId, { name: "Updated" })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should only update provided fields", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, {
        name: "Original",
        emoji: "📚",
      })

      const result = await updateSubject(deps, userId, subjectId, { name: "Updated" })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe("Updated")
        expect(result.value.emoji).toBe("📚") // Unchanged
      }
    })
  })

  describe("deleteSubject", () => {
    it("should soft-delete a subject", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const result = await deleteSubject(deps, userId, subjectId)

      expect(result.ok).toBe(true)

      // Verify it's deleted
      const getResult = await getSubject(deps, userId, subjectId)
      expect(getResult.ok).toBe(false)
    })

    it("should return NOT_FOUND if subject does not exist", async () => {
      const { id: userId } = createTestUser(db)

      const result = await deleteSubject(deps, userId, "non-existent-id")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return NOT_FOUND if subject belongs to different user", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const result = await deleteSubject(deps, user2Id, subjectId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return HAS_CATEGORIES if subject has categories", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      createTestCategory(db, userId, subjectId, { name: "Category" })

      const result = await deleteSubject(deps, userId, subjectId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("HAS_CATEGORIES")
      }
    })

    it("should allow deletion if all categories are soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      createTestCategory(db, userId, subjectId, { name: "Deleted Category", deletedAt: new Date() })

      const result = await deleteSubject(deps, userId, subjectId)

      expect(result.ok).toBe(true)
    })
  })
})

describe("Subject UseCase - Tree Operations", () => {
  let db: TestDatabase
  let subjectRepo: SubjectRepository
  let treeDeps: TreeUseCaseDeps

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subjectRepo = createSubjectRepository(db as any)
    const txRunner = createMockSimpleTransactionRunner(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    treeDeps = { subjectRepo, db: db as any, txRunner }
  })

  describe("getSubjectTree", () => {
    it("should return empty tree for subject with no categories", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const result = await getSubjectTree(treeDeps, userId, subjectId)

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
      createTestTopic(db, userId, cat1Id, { name: "Topic 1" })
      createTestTopic(db, userId, cat1Id, { name: "Topic 2" })

      const result = await getSubjectTree(treeDeps, userId, subjectId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.categories).toHaveLength(1)
        expect(result.value.categories[0].name).toBe("Category 1")
        expect(result.value.categories[0].topics).toHaveLength(2)
      }
    })

    it("should not return soft-deleted categories", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      createTestCategory(db, userId, subjectId, { name: "Active", depth: 1 })
      createTestCategory(db, userId, subjectId, { name: "Deleted", depth: 1, deletedAt: new Date() })

      const result = await getSubjectTree(treeDeps, userId, subjectId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.categories).toHaveLength(1)
        expect(result.value.categories[0].name).toBe("Active")
      }
    })

    it("should return NOT_FOUND for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)

      const result = await getSubjectTree(treeDeps, userId, "non-existent")

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

      const result = await getSubjectTree(treeDeps, user2Id, subjectId)

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

      const tree: UpdateTreeRequest = {
        categories: [
          {
            id: null,
            name: "New Category",
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
      }

      const result = await updateSubjectTree(treeDeps, userId, subjectId, tree)

      expect(result.ok).toBe(true)

      // Verify tree was created
      const treeResult = await getSubjectTree(treeDeps, userId, subjectId)
      expect(treeResult.ok).toBe(true)
      if (treeResult.ok) {
        expect(treeResult.value.categories).toHaveLength(1)
        expect(treeResult.value.categories[0].name).toBe("New Category")
        expect(treeResult.value.categories[0].topics[0].name).toBe("New Topic")
      }
    })

    it("should update existing categories", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, { name: "Original", depth: 1 })

      const tree: UpdateTreeRequest = {
        categories: [
          {
            id: catId,
            name: "Updated",
            displayOrder: 0,
            topics: [],
          },
        ],
      }

      const result = await updateSubjectTree(treeDeps, userId, subjectId, tree)

      expect(result.ok).toBe(true)

      const treeResult = await getSubjectTree(treeDeps, userId, subjectId)
      expect(treeResult.ok).toBe(true)
      if (treeResult.ok) {
        expect(treeResult.value.categories[0].name).toBe("Updated")
        expect(treeResult.value.categories[0].id).toBe(catId)
      }
    })

    it("should soft-delete nodes not in request", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, { name: "ToDelete", depth: 1 })

      const tree: UpdateTreeRequest = {
        categories: [], // Empty tree
      }

      const result = await updateSubjectTree(treeDeps, userId, subjectId, tree)

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

      const tree: UpdateTreeRequest = {
        categories: [
          {
            id: catId,
            name: "Revived",
            displayOrder: 0,
            topics: [],
          },
        ],
      }

      const result = await updateSubjectTree(treeDeps, userId, subjectId, tree)

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

      const tree: UpdateTreeRequest = {
        categories: [
          {
            id: cat2Id, // User2's category
            name: "Hijacked",
            displayOrder: 0,
            topics: [],
          },
        ],
      }

      const result = await updateSubjectTree(treeDeps, user1Id, subject1Id, tree)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("INVALID_ID")
      }
    })

    it("should return NOT_FOUND for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)

      const tree: UpdateTreeRequest = {
        categories: [],
      }

      const result = await updateSubjectTree(treeDeps, userId, "non-existent", tree)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })
  })

  describe("importCSVToSubject", () => {
    it("should import CSV data into empty subject", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const csv = `カテゴリ,論点
カテゴリ1,トピック1
カテゴリ1,トピック2`

      const result = await importCSVToSubject(treeDeps, userId, subjectId, csv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.success).toBe(true)
        expect(result.value.imported.categories).toBe(1)
        expect(result.value.imported.topics).toBe(2)
      }

      // Verify tree was created
      const tree = await getSubjectTree(treeDeps, userId, subjectId)
      expect(tree.ok).toBe(true)
      if (tree.ok) {
        expect(tree.value.categories).toHaveLength(1)
        expect(tree.value.categories[0].topics).toHaveLength(2)
      }
    })

    it("should merge with existing categories", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, { name: "カテゴリ1", depth: 1 })
      createTestTopic(db, userId, catId, { name: "既存トピック" })

      const csv = `カテゴリ,論点
カテゴリ1,新規トピック`

      const result = await importCSVToSubject(treeDeps, userId, subjectId, csv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.success).toBe(true)
      }

      // Verify merged tree
      const tree = await getSubjectTree(treeDeps, userId, subjectId)
      expect(tree.ok).toBe(true)
      if (tree.ok) {
        expect(tree.value.categories).toHaveLength(1)
        expect(tree.value.categories[0].topics).toHaveLength(2)
      }
    })

    it("should return NOT_FOUND for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)

      const csv = `カテゴリ,論点
カテゴリ,トピック`

      const result = await importCSVToSubject(treeDeps, userId, "non-existent", csv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND")
      }
    })

    it("should return success=false with errors for empty CSV", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const csv = `カテゴリ,論点
`

      const result = await importCSVToSubject(treeDeps, userId, subjectId, csv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.success).toBe(false)
        expect(result.value.errors).toHaveLength(1)
        expect(result.value.errors[0].message).toContain("インポートするデータがありません")
      }
    })
  })
})
