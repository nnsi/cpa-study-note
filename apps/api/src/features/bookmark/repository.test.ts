/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, type TestDatabase } from "../../test/mocks/db"
import { createBookmarkRepository, type BookmarkRepository } from "./repository"
import * as schema from "@cpa-study/db/schema"

describe("BookmarkRepository", () => {
  let repository: BookmarkRepository
  let db: TestDatabase
  let userId: string
  let otherUserId: string
  let domainId: string
  let subjectId: string
  let categoryId: string
  let topicId: string

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createBookmarkRepository(db as any)

    const now = new Date()
    userId = "test-user-1"
    otherUserId = "test-user-2"
    domainId = "domain-1"
    subjectId = "subject-1"
    categoryId = "category-1"
    topicId = "topic-1"

    // Create test users
    db.insert(schema.users)
      .values([
        { id: userId, email: "test1@example.com", name: "Test User 1", createdAt: now, updatedAt: now },
        { id: otherUserId, email: "test2@example.com", name: "Test User 2", createdAt: now, updatedAt: now },
      ])
      .run()

    // Create study domain
    db.insert(schema.studyDomains)
      .values({ id: domainId, userId, name: "Test Domain", createdAt: now, updatedAt: now })
      .run()

    // Create subject
    db.insert(schema.subjects)
      .values({ id: subjectId, userId, studyDomainId: domainId, name: "Test Subject", displayOrder: 0, createdAt: now, updatedAt: now })
      .run()

    // Create category
    db.insert(schema.categories)
      .values({ id: categoryId, userId, subjectId, name: "Test Category", depth: 0, displayOrder: 0, createdAt: now, updatedAt: now })
      .run()

    // Create topic
    db.insert(schema.topics)
      .values({ id: topicId, userId, categoryId, name: "Test Topic", displayOrder: 0, createdAt: now, updatedAt: now })
      .run()
  })

  describe("findBookmarksByUser", () => {
    it("should return empty array when no bookmarks", async () => {
      const result = await repository.findBookmarksByUser(userId)

      expect(result).toHaveLength(0)
    })

    it("should return user's bookmarks", async () => {
      const now = new Date()
      db.insert(schema.userBookmarks)
        .values([
          { id: "bookmark-1", userId, targetType: "subject", targetId: subjectId, createdAt: now },
          { id: "bookmark-2", userId, targetType: "topic", targetId: topicId, createdAt: now },
        ])
        .run()

      const result = await repository.findBookmarksByUser(userId)

      expect(result).toHaveLength(2)
      expect(result.map((b) => b.id)).toContain("bookmark-1")
      expect(result.map((b) => b.id)).toContain("bookmark-2")
    })

    it("should not return other user's bookmarks", async () => {
      const now = new Date()
      db.insert(schema.userBookmarks)
        .values([
          { id: "bookmark-1", userId, targetType: "subject", targetId: subjectId, createdAt: now },
          { id: "bookmark-2", userId: otherUserId, targetType: "topic", targetId: topicId, createdAt: now },
        ])
        .run()

      const result = await repository.findBookmarksByUser(userId)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("bookmark-1")
    })

    it("should return bookmarks ordered by createdAt", async () => {
      const earlier = new Date("2024-01-01")
      const later = new Date("2024-06-01")
      db.insert(schema.userBookmarks)
        .values([
          { id: "later-bookmark", userId, targetType: "topic", targetId: topicId, createdAt: later },
          { id: "earlier-bookmark", userId, targetType: "subject", targetId: subjectId, createdAt: earlier },
        ])
        .run()

      const result = await repository.findBookmarksByUser(userId)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe("earlier-bookmark")
      expect(result[1].id).toBe("later-bookmark")
    })
  })

  describe("addBookmark", () => {
    it("should add a new bookmark", async () => {
      const result = await repository.addBookmark(userId, "subject", subjectId)

      expect(result.alreadyExists).toBe(false)
      expect(result.bookmark).not.toBeNull()
      expect(result.bookmark?.userId).toBe(userId)
      expect(result.bookmark?.targetType).toBe("subject")
      expect(result.bookmark?.targetId).toBe(subjectId)
      expect(result.bookmark?.createdAt).toBeInstanceOf(Date)
    })

    it("should return alreadyExists=true for duplicate bookmark (idempotent)", async () => {
      // First add
      const first = await repository.addBookmark(userId, "topic", topicId)
      expect(first.alreadyExists).toBe(false)
      expect(first.bookmark).not.toBeNull()

      // Second add (duplicate)
      const second = await repository.addBookmark(userId, "topic", topicId)
      expect(second.alreadyExists).toBe(true)
      expect(second.bookmark).toBeNull()
    })

    it("should allow same target to be bookmarked by different users", async () => {
      const result1 = await repository.addBookmark(userId, "topic", topicId)
      const result2 = await repository.addBookmark(otherUserId, "topic", topicId)

      expect(result1.alreadyExists).toBe(false)
      expect(result2.alreadyExists).toBe(false)
    })

    it("should allow same user to bookmark different targets", async () => {
      const result1 = await repository.addBookmark(userId, "subject", subjectId)
      const result2 = await repository.addBookmark(userId, "category", categoryId)
      const result3 = await repository.addBookmark(userId, "topic", topicId)

      expect(result1.alreadyExists).toBe(false)
      expect(result2.alreadyExists).toBe(false)
      expect(result3.alreadyExists).toBe(false)
    })
  })

  describe("removeBookmark", () => {
    it("should remove existing bookmark", async () => {
      const now = new Date()
      db.insert(schema.userBookmarks)
        .values({ id: "bookmark-1", userId, targetType: "subject", targetId: subjectId, createdAt: now })
        .run()

      const result = await repository.removeBookmark(userId, "subject", subjectId)

      expect(result).toBe(true)

      // Verify bookmark is removed
      const bookmarks = await repository.findBookmarksByUser(userId)
      expect(bookmarks).toHaveLength(0)
    })

    it("should return false when bookmark not found", async () => {
      const result = await repository.removeBookmark(userId, "subject", subjectId)

      expect(result).toBe(false)
    })

    it("should return false when trying to remove other user's bookmark", async () => {
      const now = new Date()
      db.insert(schema.userBookmarks)
        .values({ id: "bookmark-1", userId: otherUserId, targetType: "subject", targetId: subjectId, createdAt: now })
        .run()

      const result = await repository.removeBookmark(userId, "subject", subjectId)

      expect(result).toBe(false)

      // Verify other user's bookmark still exists
      const bookmarks = await repository.findBookmarksByUser(otherUserId)
      expect(bookmarks).toHaveLength(1)
    })
  })

  describe("isBookmarked", () => {
    it("should return true when bookmarked", async () => {
      const now = new Date()
      db.insert(schema.userBookmarks)
        .values({ id: "bookmark-1", userId, targetType: "topic", targetId: topicId, createdAt: now })
        .run()

      const result = await repository.isBookmarked(userId, "topic", topicId)

      expect(result).toBe(true)
    })

    it("should return false when not bookmarked", async () => {
      const result = await repository.isBookmarked(userId, "topic", topicId)

      expect(result).toBe(false)
    })

    it("should return false for different target type", async () => {
      const now = new Date()
      db.insert(schema.userBookmarks)
        .values({ id: "bookmark-1", userId, targetType: "subject", targetId: subjectId, createdAt: now })
        .run()

      // Same user but checking for topic, not subject
      const result = await repository.isBookmarked(userId, "topic", subjectId)

      expect(result).toBe(false)
    })

    it("should return false for other user's bookmark", async () => {
      const now = new Date()
      db.insert(schema.userBookmarks)
        .values({ id: "bookmark-1", userId: otherUserId, targetType: "topic", targetId: topicId, createdAt: now })
        .run()

      const result = await repository.isBookmarked(userId, "topic", topicId)

      expect(result).toBe(false)
    })
  })

  describe("targetExists", () => {
    it("should return true for existing subject", async () => {
      const result = await repository.targetExists("subject", subjectId, userId)

      expect(result).toBe(true)
    })

    it("should return true for existing category", async () => {
      const result = await repository.targetExists("category", categoryId, userId)

      expect(result).toBe(true)
    })

    it("should return true for existing topic", async () => {
      const result = await repository.targetExists("topic", topicId, userId)

      expect(result).toBe(true)
    })

    it("should return false for non-existent subject", async () => {
      const result = await repository.targetExists("subject", "non-existent", userId)

      expect(result).toBe(false)
    })

    it("should return false for non-existent category", async () => {
      const result = await repository.targetExists("category", "non-existent", userId)

      expect(result).toBe(false)
    })

    it("should return false for non-existent topic", async () => {
      const result = await repository.targetExists("topic", "non-existent", userId)

      expect(result).toBe(false)
    })

    it("should respect user boundary - subject", async () => {
      const result = await repository.targetExists("subject", subjectId, otherUserId)

      expect(result).toBe(false)
    })

    it("should respect user boundary - category", async () => {
      const result = await repository.targetExists("category", categoryId, otherUserId)

      expect(result).toBe(false)
    })

    it("should respect user boundary - topic", async () => {
      const result = await repository.targetExists("topic", topicId, otherUserId)

      expect(result).toBe(false)
    })

    it("should return false for soft-deleted subject", async () => {
      const now = new Date()
      db.update(schema.subjects).set({ deletedAt: now }).run()

      const result = await repository.targetExists("subject", subjectId, userId)

      expect(result).toBe(false)
    })

    it("should return false for soft-deleted category", async () => {
      const now = new Date()
      db.update(schema.categories).set({ deletedAt: now }).run()

      const result = await repository.targetExists("category", categoryId, userId)

      expect(result).toBe(false)
    })

    it("should return false for soft-deleted topic", async () => {
      const now = new Date()
      db.update(schema.topics).set({ deletedAt: now }).run()

      const result = await repository.targetExists("topic", topicId, userId)

      expect(result).toBe(false)
    })
  })

  describe("getBookmarkDetails", () => {
    describe("subject", () => {
      it("should return details for subject", async () => {
        const result = await repository.getBookmarkDetails("subject", subjectId, userId)

        expect(result).not.toBeNull()
        expect(result?.name).toBe("Test Subject")
        expect(result?.path).toBe("Test Subject")
        expect(result?.domainId).toBe(domainId)
        expect(result?.subjectId).toBeNull()
        expect(result?.categoryId).toBeNull()
      })

      it("should return null for non-existent subject", async () => {
        const result = await repository.getBookmarkDetails("subject", "non-existent", userId)

        expect(result).toBeNull()
      })

      it("should return null for other user's subject", async () => {
        const result = await repository.getBookmarkDetails("subject", subjectId, otherUserId)

        expect(result).toBeNull()
      })

      it("should return null for soft-deleted subject", async () => {
        const now = new Date()
        db.update(schema.subjects).set({ deletedAt: now }).run()

        const result = await repository.getBookmarkDetails("subject", subjectId, userId)

        expect(result).toBeNull()
      })
    })

    describe("category", () => {
      it("should return details for category with correct path", async () => {
        const result = await repository.getBookmarkDetails("category", categoryId, userId)

        expect(result).not.toBeNull()
        expect(result?.name).toBe("Test Category")
        expect(result?.path).toBe("Test Subject > Test Category")
        expect(result?.domainId).toBe(domainId)
        expect(result?.subjectId).toBe(subjectId)
        expect(result?.categoryId).toBeNull()
      })

      it("should return null for non-existent category", async () => {
        const result = await repository.getBookmarkDetails("category", "non-existent", userId)

        expect(result).toBeNull()
      })

      it("should return null for other user's category", async () => {
        const result = await repository.getBookmarkDetails("category", categoryId, otherUserId)

        expect(result).toBeNull()
      })

      it("should return null for soft-deleted category", async () => {
        const now = new Date()
        db.update(schema.categories).set({ deletedAt: now }).run()

        const result = await repository.getBookmarkDetails("category", categoryId, userId)

        expect(result).toBeNull()
      })

      it("should return null when parent subject is soft-deleted", async () => {
        const now = new Date()
        db.update(schema.subjects).set({ deletedAt: now }).run()

        const result = await repository.getBookmarkDetails("category", categoryId, userId)

        expect(result).toBeNull()
      })
    })

    describe("topic", () => {
      it("should return details for topic with correct path", async () => {
        const result = await repository.getBookmarkDetails("topic", topicId, userId)

        expect(result).not.toBeNull()
        expect(result?.name).toBe("Test Topic")
        expect(result?.path).toBe("Test Subject > Test Category > Test Topic")
        expect(result?.domainId).toBe(domainId)
        expect(result?.subjectId).toBe(subjectId)
        expect(result?.categoryId).toBe(categoryId)
      })

      it("should return null for non-existent topic", async () => {
        const result = await repository.getBookmarkDetails("topic", "non-existent", userId)

        expect(result).toBeNull()
      })

      it("should return null for other user's topic", async () => {
        const result = await repository.getBookmarkDetails("topic", topicId, otherUserId)

        expect(result).toBeNull()
      })

      it("should return null for soft-deleted topic", async () => {
        const now = new Date()
        db.update(schema.topics).set({ deletedAt: now }).run()

        const result = await repository.getBookmarkDetails("topic", topicId, userId)

        expect(result).toBeNull()
      })

      it("should return null when parent category is soft-deleted", async () => {
        const now = new Date()
        db.update(schema.categories).set({ deletedAt: now }).run()

        const result = await repository.getBookmarkDetails("topic", topicId, userId)

        expect(result).toBeNull()
      })

      it("should return null when parent subject is soft-deleted", async () => {
        const now = new Date()
        db.update(schema.subjects).set({ deletedAt: now }).run()

        const result = await repository.getBookmarkDetails("topic", topicId, userId)

        expect(result).toBeNull()
      })
    })
  })
})
