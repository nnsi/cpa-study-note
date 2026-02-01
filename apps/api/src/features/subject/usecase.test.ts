import { describe, it, expect, beforeEach } from "vitest"
import { createSubjectRepository } from "./repository"
import {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  type SubjectUseCaseDeps,
} from "./usecase"
import { createTestDatabase, type TestDatabase } from "@/test/mocks/db"
import { createTestUser, createTestStudyDomain, createTestSubject, createTestCategory } from "@/test/helpers"

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
