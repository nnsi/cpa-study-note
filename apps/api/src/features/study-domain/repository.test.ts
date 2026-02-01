/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, seedTestData, type TestDatabase } from "../../test/mocks/db"
import { createStudyDomainRepository, type StudyDomainRepository } from "./repository"
import * as schema from "@cpa-study/db/schema"

describe("StudyDomainRepository", () => {
  let repository: StudyDomainRepository
  let testData: ReturnType<typeof seedTestData>
  let db: TestDatabase

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    testData = seedTestData(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createStudyDomainRepository(db as any)
  })

  describe("findAllPublic", () => {
    it("should return all public study domains", async () => {
      const domains = await repository.findAllPublic()

      expect(domains.length).toBeGreaterThanOrEqual(1)
      expect(domains.some((d) => d.id === "cpa")).toBe(true)
      domains.forEach((domain) => {
        expect(domain.isPublic).toBe(true)
      })
    })

    it("should return domains ordered by name", async () => {
      const now = new Date()
      // Add another public domain
      db.insert(schema.studyDomains)
        .values({
          id: "aaa-domain",
          name: "AAA Domain",
          description: "First alphabetically",
          isPublic: true,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      db.insert(schema.studyDomains)
        .values({
          id: "zzz-domain",
          name: "ZZZ Domain",
          description: "Last alphabetically",
          isPublic: true,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const domains = await repository.findAllPublic()

      // Should be sorted by name
      for (let i = 0; i < domains.length - 1; i++) {
        expect(domains[i].name.localeCompare(domains[i + 1].name)).toBeLessThanOrEqual(0)
      }
    })

    it("should not return private domains", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({
          id: "private-domain",
          name: "Private Domain",
          description: "Not public",
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const domains = await repository.findAllPublic()

      expect(domains.some((d) => d.id === "private-domain")).toBe(false)
    })

    it("should return empty array when no public domains exist", async () => {
      // Delete all existing domains
      db.delete(schema.subjects).run()
      db.delete(schema.studyDomains).run()

      const domains = await repository.findAllPublic()

      expect(domains).toHaveLength(0)
    })
  })

  describe("findById", () => {
    it("should return study domain when exists", async () => {
      const domain = await repository.findById("cpa")

      expect(domain).not.toBeNull()
      expect(domain?.id).toBe("cpa")
      expect(domain?.name).toBe("公認会計士試験")
      expect(domain?.description).toBe("公認会計士試験の学習")
      expect(domain?.isPublic).toBe(true)
    })

    it("should return null when domain does not exist", async () => {
      const domain = await repository.findById("non-existent")

      expect(domain).toBeNull()
    })

    it("should return private domain by ID", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({
          id: "private-domain",
          name: "Private Domain",
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const domain = await repository.findById("private-domain")

      expect(domain).not.toBeNull()
      expect(domain?.isPublic).toBe(false)
    })
  })

  describe("create", () => {
    it("should create a new study domain with all fields", async () => {
      const domain = await repository.create({
        id: "new-domain",
        name: "New Domain",
        description: "A new study domain",
        emoji: "📖",
        color: "blue",
        isPublic: true,
      })

      expect(domain.id).toBe("new-domain")
      expect(domain.name).toBe("New Domain")
      expect(domain.description).toBe("A new study domain")
      expect(domain.emoji).toBe("📖")
      expect(domain.color).toBe("blue")
      expect(domain.isPublic).toBe(true)
      expect(domain.createdAt).toBeInstanceOf(Date)
      expect(domain.updatedAt).toBeInstanceOf(Date)
    })

    it("should create domain with minimal fields", async () => {
      const domain = await repository.create({
        id: "minimal-domain",
        name: "Minimal Domain",
      })

      expect(domain.id).toBe("minimal-domain")
      expect(domain.name).toBe("Minimal Domain")
      expect(domain.description).toBeNull()
      expect(domain.emoji).toBeNull()
      expect(domain.color).toBeNull()
      expect(domain.isPublic).toBe(true) // default
    })

    it("should create private domain", async () => {
      const domain = await repository.create({
        id: "private-new",
        name: "Private Domain",
        isPublic: false,
      })

      expect(domain.isPublic).toBe(false)
    })
  })

  describe("update", () => {
    it("should update study domain name", async () => {
      const updated = await repository.update("cpa", {
        name: "Updated Name",
      })

      expect(updated).not.toBeNull()
      expect(updated?.name).toBe("Updated Name")
      expect(updated?.description).toBe("公認会計士試験の学習") // unchanged
    })

    it("should update multiple fields", async () => {
      const updated = await repository.update("cpa", {
        name: "New Name",
        description: "New Description",
        emoji: "🎓",
        color: "green",
        isPublic: false,
      })

      expect(updated?.name).toBe("New Name")
      expect(updated?.description).toBe("New Description")
      expect(updated?.emoji).toBe("🎓")
      expect(updated?.color).toBe("green")
      expect(updated?.isPublic).toBe(false)
    })

    it("should update updatedAt timestamp", async () => {
      const before = await repository.findById("cpa")
      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await repository.update("cpa", {
        name: "Updated",
      })

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime())
    })

    it("should return null when domain does not exist", async () => {
      const updated = await repository.update("non-existent", {
        name: "New Name",
      })

      expect(updated).toBeNull()
    })

    it("should allow setting description to null", async () => {
      const updated = await repository.update("cpa", {
        description: null,
      })

      expect(updated?.description).toBeNull()
    })
  })

  describe("remove", () => {
    it("should remove study domain", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({
          id: "to-delete",
          name: "To Delete",
          isPublic: true,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const result = await repository.remove("to-delete")

      expect(result).toBe(true)

      const found = await repository.findById("to-delete")
      expect(found).toBeNull()
    })

    it("should return true even when domain does not exist", async () => {
      // Drizzle delete doesn't throw on non-existent rows
      const result = await repository.remove("non-existent")

      expect(result).toBe(true)
    })
  })

  describe("canDeleteStudyDomain", () => {
    it("should return canDelete=false when subjects exist", async () => {
      const result = await repository.canDeleteStudyDomain("cpa")

      expect(result.canDelete).toBe(false)
      expect(result.reason).toContain("件の科目が紐づいています")
    })

    it("should return canDelete=true when no subjects exist", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({
          id: "empty-domain",
          name: "Empty Domain",
          isPublic: true,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const result = await repository.canDeleteStudyDomain("empty-domain")

      expect(result.canDelete).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it("should return canDelete=true for non-existent domain", async () => {
      const result = await repository.canDeleteStudyDomain("non-existent")

      expect(result.canDelete).toBe(true)
    })

    it("should count subjects correctly", async () => {
      const now = new Date()
      // Create domain with multiple subjects
      db.insert(schema.studyDomains)
        .values({
          id: "multi-subject",
          name: "Multi Subject Domain",
          isPublic: true,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      db.insert(schema.subjects)
        .values([
          {
            id: "subj-1",
            studyDomainId: "multi-subject",
            name: "Subject 1",
            displayOrder: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "subj-2",
            studyDomainId: "multi-subject",
            name: "Subject 2",
            displayOrder: 2,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run()

      const result = await repository.canDeleteStudyDomain("multi-subject")

      expect(result.canDelete).toBe(false)
      expect(result.reason).toContain("2件の科目が紐づいています")
    })
  })

  describe("findByUserId", () => {
    it("should return user's joined study domains", async () => {
      const now = new Date()
      db.insert(schema.userStudyDomains)
        .values({
          id: "usd-1",
          userId: testData.userId,
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      const userDomains = await repository.findByUserId(testData.userId)

      expect(userDomains.length).toBe(1)
      expect(userDomains[0].userId).toBe(testData.userId)
      expect(userDomains[0].studyDomainId).toBe("cpa")
      expect(userDomains[0].studyDomain.name).toBe("公認会計士試験")
    })

    it("should return empty array when user has no joined domains", async () => {
      const userDomains = await repository.findByUserId("user-with-no-domains")

      expect(userDomains).toHaveLength(0)
    })

    it("should return domains ordered by joinedAt", async () => {
      const now = new Date()
      const later = new Date(now.getTime() + 1000)

      // Create another domain
      db.insert(schema.studyDomains)
        .values({
          id: "another-domain",
          name: "Another Domain",
          isPublic: true,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      db.insert(schema.userStudyDomains)
        .values([
          {
            id: "usd-first",
            userId: testData.userId,
            studyDomainId: "cpa",
            joinedAt: now,
          },
          {
            id: "usd-second",
            userId: testData.userId,
            studyDomainId: "another-domain",
            joinedAt: later,
          },
        ])
        .run()

      const userDomains = await repository.findByUserId(testData.userId)

      expect(userDomains.length).toBe(2)
      expect(userDomains[0].studyDomainId).toBe("cpa")
      expect(userDomains[1].studyDomainId).toBe("another-domain")
    })

    it("should include full study domain details", async () => {
      const now = new Date()
      db.insert(schema.userStudyDomains)
        .values({
          id: "usd-full",
          userId: testData.userId,
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      const userDomains = await repository.findByUserId(testData.userId)

      expect(userDomains[0].studyDomain).toBeDefined()
      expect(userDomains[0].studyDomain.id).toBe("cpa")
      expect(userDomains[0].studyDomain.name).toBe("公認会計士試験")
      expect(userDomains[0].studyDomain.description).toBe("公認会計士試験の学習")
      expect(userDomains[0].studyDomain.emoji).toBe("📚")
      expect(userDomains[0].studyDomain.color).toBe("indigo")
    })
  })

  describe("joinDomain", () => {
    it("should create user study domain record", async () => {
      const userDomain = await repository.joinDomain(testData.userId, "cpa")

      expect(userDomain.id).toBeDefined()
      expect(userDomain.userId).toBe(testData.userId)
      expect(userDomain.studyDomainId).toBe("cpa")
      expect(userDomain.joinedAt).toBeInstanceOf(Date)
    })

    it("should generate unique IDs for each join", async () => {
      const now = new Date()
      // Create another domain and user
      db.insert(schema.studyDomains)
        .values({
          id: "domain-2",
          name: "Domain 2",
          isPublic: true,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      db.insert(schema.users)
        .values({
          id: "user-2",
          email: "user2@example.com",
          name: "User 2",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const join1 = await repository.joinDomain(testData.userId, "cpa")
      const join2 = await repository.joinDomain("user-2", "domain-2")

      expect(join1.id).not.toBe(join2.id)
    })
  })

  describe("leaveDomain", () => {
    it("should remove user study domain record", async () => {
      const now = new Date()
      db.insert(schema.userStudyDomains)
        .values({
          id: "usd-to-leave",
          userId: testData.userId,
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      const result = await repository.leaveDomain(testData.userId, "cpa")

      expect(result).toBe(true)

      const found = await repository.findUserStudyDomain(testData.userId, "cpa")
      expect(found).toBeNull()
    })

    it("should return true even when record does not exist", async () => {
      const result = await repository.leaveDomain(testData.userId, "non-existent")

      expect(result).toBe(true)
    })

    it("should only remove the specific user-domain combination", async () => {
      const now = new Date()

      // Create another user
      db.insert(schema.users)
        .values({
          id: "other-user",
          email: "other@example.com",
          name: "Other User",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Both users join the same domain
      db.insert(schema.userStudyDomains)
        .values([
          {
            id: "usd-user1",
            userId: testData.userId,
            studyDomainId: "cpa",
            joinedAt: now,
          },
          {
            id: "usd-user2",
            userId: "other-user",
            studyDomainId: "cpa",
            joinedAt: now,
          },
        ])
        .run()

      // User 1 leaves
      await repository.leaveDomain(testData.userId, "cpa")

      // User 2 should still be joined
      const otherUserDomain = await repository.findUserStudyDomain("other-user", "cpa")
      expect(otherUserDomain).not.toBeNull()
    })

    it("should preserve learning history (progress records) when leaving", async () => {
      const now = new Date()

      // User joins domain
      db.insert(schema.userStudyDomains)
        .values({
          id: "usd-progress-test",
          userId: testData.userId,
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      // User has learning progress
      db.insert(schema.userTopicProgress)
        .values({
          id: "progress-1",
          userId: testData.userId,
          topicId: testData.topicId,
          understood: true,
          questionCount: 5,
          goodQuestionCount: 2,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // User leaves domain
      await repository.leaveDomain(testData.userId, "cpa")

      // Verify user_study_domains record is removed
      const userDomain = await repository.findUserStudyDomain(testData.userId, "cpa")
      expect(userDomain).toBeNull()

      // Verify progress record is preserved (query directly)
      const progressRecords = db.select().from(schema.userTopicProgress).all()
      const progressResult = progressRecords.find((p) => p.id === "progress-1")
      expect(progressResult).toBeDefined()
      expect(progressResult?.understood).toBe(true)
      expect(progressResult?.questionCount).toBe(5)
    })
  })

  describe("findUserStudyDomain", () => {
    it("should return user study domain when exists", async () => {
      const now = new Date()
      db.insert(schema.userStudyDomains)
        .values({
          id: "usd-find",
          userId: testData.userId,
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      const found = await repository.findUserStudyDomain(testData.userId, "cpa")

      expect(found).not.toBeNull()
      expect(found?.userId).toBe(testData.userId)
      expect(found?.studyDomainId).toBe("cpa")
    })

    it("should return null when user has not joined domain", async () => {
      const found = await repository.findUserStudyDomain(testData.userId, "cpa")

      expect(found).toBeNull()
    })

    it("should return null when domain does not exist", async () => {
      const found = await repository.findUserStudyDomain(testData.userId, "non-existent")

      expect(found).toBeNull()
    })

    it("should not return other user's join record", async () => {
      const now = new Date()

      db.insert(schema.users)
        .values({
          id: "other-user-find",
          email: "other-find@example.com",
          name: "Other User",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      db.insert(schema.userStudyDomains)
        .values({
          id: "usd-other",
          userId: "other-user-find",
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      const found = await repository.findUserStudyDomain(testData.userId, "cpa")

      expect(found).toBeNull()
    })
  })
})
