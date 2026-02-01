/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, type TestDatabase } from "../../test/mocks/db"
import { createStudyDomainRepository, type StudyDomainRepository } from "./repository"
import * as schema from "@cpa-study/db/schema"

describe("StudyDomainRepository", () => {
  let repository: StudyDomainRepository
  let db: TestDatabase
  let userId: string
  let otherUserId: string

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createStudyDomainRepository(db as any)

    // Create test users
    const now = new Date()
    userId = "test-user-1"
    otherUserId = "test-user-2"

    db.insert(schema.users)
      .values([
        { id: userId, email: "test1@example.com", name: "Test User 1", createdAt: now, updatedAt: now },
        { id: otherUserId, email: "test2@example.com", name: "Test User 2", createdAt: now, updatedAt: now },
      ])
      .run()
  })

  describe("findByUserId", () => {
    it("should return only domains owned by the user", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values([
          { id: "domain-1", userId, name: "User1 Domain", createdAt: now, updatedAt: now },
          { id: "domain-2", userId: otherUserId, name: "User2 Domain", createdAt: now, updatedAt: now },
        ])
        .run()

      const result = await repository.findByUserId(userId)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("User1 Domain")
    })

    it("should not return soft-deleted domains", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values([
          { id: "active", userId, name: "Active", createdAt: now, updatedAt: now },
          { id: "deleted", userId, name: "Deleted", createdAt: now, updatedAt: now, deletedAt: now },
        ])
        .run()

      const result = await repository.findByUserId(userId)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("Active")
    })

    it("should return empty array when user has no domains", async () => {
      const result = await repository.findByUserId(userId)

      expect(result).toHaveLength(0)
    })

    it("should return domains ordered by createdAt", async () => {
      const earlier = new Date("2024-01-01")
      const later = new Date("2024-06-01")
      db.insert(schema.studyDomains)
        .values([
          { id: "later", userId, name: "Later Domain", createdAt: later, updatedAt: later },
          { id: "earlier", userId, name: "Earlier Domain", createdAt: earlier, updatedAt: earlier },
        ])
        .run()

      const result = await repository.findByUserId(userId)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe("Earlier Domain")
      expect(result[1].name).toBe("Later Domain")
    })
  })

  describe("findById", () => {
    it("should return domain if owned by user", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId, name: "My Domain", createdAt: now, updatedAt: now })
        .run()

      const result = await repository.findById("domain-1", userId)

      expect(result).not.toBeNull()
      expect(result?.id).toBe("domain-1")
      expect(result?.name).toBe("My Domain")
    })

    it("should return null if owned by different user", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId: otherUserId, name: "Other Domain", createdAt: now, updatedAt: now })
        .run()

      const result = await repository.findById("domain-1", userId)

      expect(result).toBeNull()
    })

    it("should return null if soft-deleted", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId, name: "Deleted", createdAt: now, updatedAt: now, deletedAt: now })
        .run()

      const result = await repository.findById("domain-1", userId)

      expect(result).toBeNull()
    })

    it("should return null when domain does not exist", async () => {
      const result = await repository.findById("non-existent", userId)

      expect(result).toBeNull()
    })
  })

  describe("create", () => {
    it("should create a new study domain with all fields", async () => {
      const result = await repository.create({
        userId,
        name: "New Domain",
        description: "A new study domain",
        emoji: "📖",
        color: "blue",
      })

      expect(result.id).toBeDefined()

      const found = await repository.findById(result.id, userId)
      expect(found?.name).toBe("New Domain")
      expect(found?.description).toBe("A new study domain")
      expect(found?.emoji).toBe("📖")
      expect(found?.color).toBe("blue")
      expect(found?.userId).toBe(userId)
      expect(found?.createdAt).toBeInstanceOf(Date)
      expect(found?.updatedAt).toBeInstanceOf(Date)
    })

    it("should create domain with minimal fields", async () => {
      const result = await repository.create({
        userId,
        name: "Minimal Domain",
      })

      const found = await repository.findById(result.id, userId)
      expect(found?.name).toBe("Minimal Domain")
      expect(found?.description).toBeNull()
      expect(found?.emoji).toBeNull()
      expect(found?.color).toBeNull()
    })
  })

  describe("update", () => {
    it("should update study domain name", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId, name: "Old Name", description: "Description", createdAt: now, updatedAt: now })
        .run()

      const updated = await repository.update("domain-1", userId, {
        name: "Updated Name",
      })

      expect(updated).not.toBeNull()
      expect(updated?.name).toBe("Updated Name")
      expect(updated?.description).toBe("Description") // unchanged
    })

    it("should update multiple fields", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId, name: "Old", createdAt: now, updatedAt: now })
        .run()

      const updated = await repository.update("domain-1", userId, {
        name: "New Name",
        description: "New Description",
        emoji: "🎓",
        color: "green",
      })

      expect(updated?.name).toBe("New Name")
      expect(updated?.description).toBe("New Description")
      expect(updated?.emoji).toBe("🎓")
      expect(updated?.color).toBe("green")
    })

    it("should update updatedAt timestamp", async () => {
      const oldTime = new Date("2024-01-01")
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId, name: "Domain", createdAt: oldTime, updatedAt: oldTime })
        .run()

      const updated = await repository.update("domain-1", userId, { name: "Updated" })

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(oldTime.getTime())
    })

    it("should return null when domain does not exist", async () => {
      const updated = await repository.update("non-existent", userId, { name: "New Name" })

      expect(updated).toBeNull()
    })

    it("should return null when domain belongs to different user", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId: otherUserId, name: "Other Domain", createdAt: now, updatedAt: now })
        .run()

      const updated = await repository.update("domain-1", userId, { name: "Hijacked" })

      expect(updated).toBeNull()
    })

    it("should allow setting description to null", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId, name: "Domain", description: "Has desc", createdAt: now, updatedAt: now })
        .run()

      const updated = await repository.update("domain-1", userId, { description: null })

      expect(updated?.description).toBeNull()
    })
  })

  describe("softDelete", () => {
    it("should set deletedAt timestamp", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId, name: "To Delete", createdAt: now, updatedAt: now })
        .run()

      const result = await repository.softDelete("domain-1", userId)

      expect(result).toBe(true)

      // Should not be found via normal query
      const found = await repository.findById("domain-1", userId)
      expect(found).toBeNull()

      // But exists in DB with deletedAt set
      const raw = db.select().from(schema.studyDomains).all()
      const deleted = raw.find((d) => d.id === "domain-1")
      expect(deleted?.deletedAt).not.toBeNull()
    })

    it("should return false when domain does not exist", async () => {
      const result = await repository.softDelete("non-existent", userId)

      expect(result).toBe(false)
    })

    it("should return false when domain belongs to different user", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId: otherUserId, name: "Other Domain", createdAt: now, updatedAt: now })
        .run()

      const result = await repository.softDelete("domain-1", userId)

      expect(result).toBe(false)
    })

    it("should return false when already soft-deleted", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId, name: "Already Deleted", createdAt: now, updatedAt: now, deletedAt: now })
        .run()

      const result = await repository.softDelete("domain-1", userId)

      expect(result).toBe(false)
    })
  })

  describe("canDeleteStudyDomain", () => {
    it("should return canDelete=false when subjects exist", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId, name: "Domain", createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.subjects)
        .values({ id: "subject-1", userId, studyDomainId: "domain-1", name: "Subject", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()

      const result = await repository.canDeleteStudyDomain("domain-1", userId)

      expect(result.canDelete).toBe(false)
      expect(result.reason).toContain("件の科目が紐づいています")
    })

    it("should return canDelete=true when no subjects exist", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "empty-domain", userId, name: "Empty Domain", createdAt: now, updatedAt: now })
        .run()

      const result = await repository.canDeleteStudyDomain("empty-domain", userId)

      expect(result.canDelete).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it("should return canDelete=true for non-existent domain", async () => {
      const result = await repository.canDeleteStudyDomain("non-existent", userId)

      expect(result.canDelete).toBe(true)
    })

    it("should not count soft-deleted subjects", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "domain-1", userId, name: "Domain", createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.subjects)
        .values({ id: "subject-1", userId, studyDomainId: "domain-1", name: "Deleted Subject", displayOrder: 0, createdAt: now, updatedAt: now, deletedAt: now })
        .run()

      const result = await repository.canDeleteStudyDomain("domain-1", userId)

      expect(result.canDelete).toBe(true)
    })

    it("should count subjects correctly", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "multi-subject", userId, name: "Multi Subject Domain", createdAt: now, updatedAt: now })
        .run()

      db.insert(schema.subjects)
        .values([
          { id: "subj-1", userId, studyDomainId: "multi-subject", name: "Subject 1", displayOrder: 1, createdAt: now, updatedAt: now },
          { id: "subj-2", userId, studyDomainId: "multi-subject", name: "Subject 2", displayOrder: 2, createdAt: now, updatedAt: now },
        ])
        .run()

      const result = await repository.canDeleteStudyDomain("multi-subject", userId)

      expect(result.canDelete).toBe(false)
      expect(result.reason).toContain("2件の科目が紐づいています")
    })
  })
})
