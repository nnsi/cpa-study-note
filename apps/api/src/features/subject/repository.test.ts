import { describe, it, expect, beforeEach } from "vitest"
import { createSubjectRepository, type SubjectRepository } from "./repository"
import { createTestDatabase, type TestDatabase } from "@/test/mocks/db"
import { createTestUser, createTestStudyDomain, createTestSubject, createTestCategory, createTestTopic } from "@/test/helpers"

describe("SubjectRepository", () => {
  let db: TestDatabase
  let repo: SubjectRepository

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    repo = createSubjectRepository(db)
  })

  describe("findByStudyDomainId", () => {
    it("should return only subjects owned by the user", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domain1Id } = createTestStudyDomain(db, user1Id)
      const { id: domain2Id } = createTestStudyDomain(db, user2Id)

      createTestSubject(db, user1Id, domain1Id, { name: "User1 Subject" })
      createTestSubject(db, user2Id, domain2Id, { name: "User2 Subject" })

      const result = await repo.findByStudyDomainId(domain1Id, user1Id)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("User1 Subject")
    })

    it("should not return soft-deleted subjects", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)

      createTestSubject(db, userId, domainId, { name: "Active" })
      createTestSubject(db, userId, domainId, { name: "Deleted", deletedAt: new Date() })

      const result = await repo.findByStudyDomainId(domainId, userId)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("Active")
    })

    it("should not return subjects if parent domain is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId, { deletedAt: new Date() })

      createTestSubject(db, userId, domainId, { name: "Subject" })

      const result = await repo.findByStudyDomainId(domainId, userId)

      expect(result).toHaveLength(0)
    })

    it("should return subjects ordered by displayOrder", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)

      createTestSubject(db, userId, domainId, { name: "Third" })
      createTestSubject(db, userId, domainId, { name: "First" })
      createTestSubject(db, userId, domainId, { name: "Second" })

      // Update display orders manually
      db.run(`UPDATE subjects SET display_order = 2 WHERE name = 'Third'`)
      db.run(`UPDATE subjects SET display_order = 0 WHERE name = 'First'`)
      db.run(`UPDATE subjects SET display_order = 1 WHERE name = 'Second'`)

      const result = await repo.findByStudyDomainId(domainId, userId)

      expect(result).toHaveLength(3)
      expect(result[0].name).toBe("First")
      expect(result[1].name).toBe("Second")
      expect(result[2].name).toBe("Third")
    })

    it("should return empty array if user has no subjects in domain", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)

      createTestSubject(db, user1Id, domainId, { name: "User1 Subject" })

      const result = await repo.findByStudyDomainId(domainId, user2Id)

      expect(result).toHaveLength(0)
    })
  })

  describe("findById", () => {
    it("should return subject if owned by user", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { name: "My Subject" })

      const result = await repo.findById(subjectId, userId)

      expect(result).not.toBeNull()
      expect(result!.id).toBe(subjectId)
      expect(result!.name).toBe("My Subject")
    })

    it("should return null if owned by different user", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const result = await repo.findById(subjectId, user2Id)

      expect(result).toBeNull()
    })

    it("should return null if soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { deletedAt: new Date() })

      const result = await repo.findById(subjectId, userId)

      expect(result).toBeNull()
    })

    it("should return null if parent domain is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId, { deletedAt: new Date() })
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const result = await repo.findById(subjectId, userId)

      expect(result).toBeNull()
    })

    it("should return null for non-existent id", async () => {
      const { id: userId } = createTestUser(db)

      const result = await repo.findById("non-existent-id", userId)

      expect(result).toBeNull()
    })
  })

  describe("create", () => {
    it("should create a new subject with all fields", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)

      const { id: subjectId } = await repo.create({
        userId,
        studyDomainId: domainId,
        name: "New Subject",
        description: "A description",
        emoji: "📚",
        color: "blue",
        displayOrder: 5,
      })

      expect(subjectId).toBeDefined()

      const result = await repo.findById(subjectId, userId)
      expect(result).not.toBeNull()
      expect(result!.name).toBe("New Subject")
      expect(result!.description).toBe("A description")
      expect(result!.emoji).toBe("📚")
      expect(result!.color).toBe("blue")
      expect(result!.displayOrder).toBe(5)
    })

    it("should create a subject with only required fields", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)

      const { id: subjectId } = await repo.create({
        userId,
        studyDomainId: domainId,
        name: "Minimal Subject",
      })

      const result = await repo.findById(subjectId, userId)
      expect(result).not.toBeNull()
      expect(result!.name).toBe("Minimal Subject")
      expect(result!.description).toBeNull()
      expect(result!.emoji).toBeNull()
      expect(result!.color).toBeNull()
      expect(result!.displayOrder).toBe(0)
    })

    it("should set createdAt and updatedAt timestamps", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)

      const { id: subjectId } = await repo.create({
        userId,
        studyDomainId: domainId,
        name: "Test Subject",
      })

      const result = await repo.findById(subjectId, userId)
      // Timestamps should be set (SQLite stores in seconds precision)
      expect(result!.createdAt).toBeInstanceOf(Date)
      expect(result!.updatedAt).toBeInstanceOf(Date)
      expect(result!.createdAt.getTime()).toBeGreaterThan(0)
      expect(result!.updatedAt.getTime()).toBeGreaterThan(0)
    })
  })

  describe("update", () => {
    it("should update subject if owned by user", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { name: "Original" })

      const result = await repo.update(subjectId, userId, {
        name: "Updated",
        description: "New description",
      })

      expect(result).not.toBeNull()
      expect(result!.name).toBe("Updated")
      expect(result!.description).toBe("New description")
    })

    it("should return null if owned by different user", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const result = await repo.update(subjectId, user2Id, { name: "Hijacked" })

      expect(result).toBeNull()
    })

    it("should return null if soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { deletedAt: new Date() })

      const result = await repo.update(subjectId, userId, { name: "Updated" })

      expect(result).toBeNull()
    })

    it("should return null if parent domain is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId, { deletedAt: new Date() })
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const result = await repo.update(subjectId, userId, { name: "Updated" })

      expect(result).toBeNull()
    })

    it("should only update provided fields", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, {
        name: "Original",
        emoji: "📚",
      })

      const result = await repo.update(subjectId, userId, { name: "Updated" })

      expect(result).not.toBeNull()
      expect(result!.name).toBe("Updated")
      expect(result!.emoji).toBe("📚") // Unchanged
    })

    it("should update updatedAt timestamp", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const before = await repo.findById(subjectId, userId)
      await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay

      const result = await repo.update(subjectId, userId, { name: "Updated" })

      expect(result!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime())
    })

    it("should allow setting description to null", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      // Set initial description
      await repo.update(subjectId, userId, { description: "Initial" })

      const result = await repo.update(subjectId, userId, { description: null })

      expect(result!.description).toBeNull()
    })
  })

  describe("softDelete", () => {
    it("should set deletedAt timestamp", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const result = await repo.softDelete(subjectId, userId)

      expect(result).toBe(true)

      // Verify it's deleted (findById should return null)
      const deleted = await repo.findById(subjectId, userId)
      expect(deleted).toBeNull()
    })

    it("should return false if owned by different user", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const result = await repo.softDelete(subjectId, user2Id)

      expect(result).toBe(false)

      // Verify it's still accessible by owner
      const stillExists = await repo.findById(subjectId, user1Id)
      expect(stillExists).not.toBeNull()
    })

    it("should return false if already soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { deletedAt: new Date() })

      const result = await repo.softDelete(subjectId, userId)

      expect(result).toBe(false)
    })

    it("should return false if parent domain is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId, { deletedAt: new Date() })
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const result = await repo.softDelete(subjectId, userId)

      expect(result).toBe(false)
    })

    it("should return false for non-existent id", async () => {
      const { id: userId } = createTestUser(db)

      const result = await repo.softDelete("non-existent-id", userId)

      expect(result).toBe(false)
    })
  })

  describe("canDeleteSubject", () => {
    it("should return canDelete: true if no categories exist", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const result = await repo.canDeleteSubject(subjectId, userId)

      expect(result.canDelete).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it("should return canDelete: false if categories exist", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      createTestCategory(db, userId, subjectId, { name: "Category 1" })
      createTestCategory(db, userId, subjectId, { name: "Category 2" })

      const result = await repo.canDeleteSubject(subjectId, userId)

      expect(result.canDelete).toBe(false)
      expect(result.reason).toBe("2件の単元が紐づいています")
    })

    it("should ignore soft-deleted categories", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      createTestCategory(db, userId, subjectId, { name: "Active" })
      createTestCategory(db, userId, subjectId, { name: "Deleted", deletedAt: new Date() })

      const result = await repo.canDeleteSubject(subjectId, userId)

      expect(result.canDelete).toBe(false)
      expect(result.reason).toBe("1件の単元が紐づいています")
    })

    it("should return canDelete: true for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)

      const result = await repo.canDeleteSubject("non-existent-id", userId)

      expect(result.canDelete).toBe(true)
    })
  })

  describe("verifyStudyDomainOwnership", () => {
    it("should return true if user owns the study domain", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)

      const result = await repo.verifyStudyDomainOwnership(domainId, userId)

      expect(result).toBe(true)
    })

    it("should return false if user does not own the study domain", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)

      const result = await repo.verifyStudyDomainOwnership(domainId, user2Id)

      expect(result).toBe(false)
    })

    it("should return false if study domain is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId, { deletedAt: new Date() })

      const result = await repo.verifyStudyDomainOwnership(domainId, userId)

      expect(result).toBe(false)
    })

    it("should return false for non-existent domain", async () => {
      const { id: userId } = createTestUser(db)

      const result = await repo.verifyStudyDomainOwnership("non-existent-id", userId)

      expect(result).toBe(false)
    })
  })

  describe("verifyCategoryBelongsToSubject", () => {
    it("should return true if category belongs to subject", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: categoryId } = createTestCategory(db, userId, subjectId)

      const result = await repo.verifyCategoryBelongsToSubject(categoryId, subjectId, userId)

      expect(result).toBe(true)
    })

    it("should return false if category belongs to different subject", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subject1Id } = createTestSubject(db, userId, domainId, { name: "Subject 1" })
      const { id: subject2Id } = createTestSubject(db, userId, domainId, { name: "Subject 2" })
      const { id: categoryId } = createTestCategory(db, userId, subject1Id)

      const result = await repo.verifyCategoryBelongsToSubject(categoryId, subject2Id, userId)

      expect(result).toBe(false)
    })

    it("should return false if category is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: categoryId } = createTestCategory(db, userId, subjectId, { deletedAt: new Date() })

      const result = await repo.verifyCategoryBelongsToSubject(categoryId, subjectId, userId)

      expect(result).toBe(false)
    })

    it("should return false for other user's category", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)
      const { id: categoryId } = createTestCategory(db, user1Id, subjectId)

      const result = await repo.verifyCategoryBelongsToSubject(categoryId, subjectId, user2Id)

      expect(result).toBe(false)
    })
  })

  describe("verifyTopicBelongsToSubject", () => {
    it("should return true if topic belongs to subject", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: categoryId } = createTestCategory(db, userId, subjectId)
      const { id: topicId } = createTestTopic(db, userId, categoryId)

      const result = await repo.verifyTopicBelongsToSubject(topicId, subjectId, userId)

      expect(result).toBe(true)
    })

    it("should return false if topic belongs to different subject", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subject1Id } = createTestSubject(db, userId, domainId, { name: "Subject 1" })
      const { id: subject2Id } = createTestSubject(db, userId, domainId, { name: "Subject 2" })
      const { id: categoryId } = createTestCategory(db, userId, subject1Id)
      const { id: topicId } = createTestTopic(db, userId, categoryId)

      const result = await repo.verifyTopicBelongsToSubject(topicId, subject2Id, userId)

      expect(result).toBe(false)
    })

    it("should return false if topic is soft-deleted", async () => {
      const { id: userId } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: categoryId } = createTestCategory(db, userId, subjectId)
      const { id: topicId } = createTestTopic(db, userId, categoryId, { deletedAt: new Date() })

      const result = await repo.verifyTopicBelongsToSubject(topicId, subjectId, userId)

      expect(result).toBe(false)
    })

    it("should return false for other user's topic", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)
      const { id: categoryId } = createTestCategory(db, user1Id, subjectId)
      const { id: topicId } = createTestTopic(db, user1Id, categoryId)

      const result = await repo.verifyTopicBelongsToSubject(topicId, subjectId, user2Id)

      expect(result).toBe(false)
    })
  })
})
