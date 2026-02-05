/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, type TestDatabase } from "../../test/mocks/db"
import { createLearningRepository, type LearningRepository } from "./repository"
import * as schema from "@cpa-study/db/schema"

describe("LearningRepository", () => {
  let repository: LearningRepository
  let db: TestDatabase
  let userId: string
  let otherUserId: string
  let studyDomainId: string
  let subjectId: string
  let categoryId: string
  let topicId: string

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createLearningRepository(db as any)

    // Setup test data
    const now = new Date()
    userId = "test-user-1"
    otherUserId = "test-user-2"
    studyDomainId = "domain-1"
    subjectId = "subject-1"
    categoryId = "category-1"
    topicId = "topic-1"

    // Create users
    db.insert(schema.users)
      .values([
        { id: userId, email: "test1@example.com", name: "Test User 1", createdAt: now, updatedAt: now },
        { id: otherUserId, email: "test2@example.com", name: "Test User 2", createdAt: now, updatedAt: now },
      ])
      .run()

    // Create study domain
    db.insert(schema.studyDomains)
      .values({ id: studyDomainId, userId, name: "Test Domain", createdAt: now, updatedAt: now })
      .run()

    // Create subject
    db.insert(schema.subjects)
      .values({ id: subjectId, userId, studyDomainId, name: "Test Subject", displayOrder: 0, createdAt: now, updatedAt: now })
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

  describe("findProgress", () => {
    it("should return null when progress not found", async () => {
      const result = await repository.findProgress(userId, topicId)

      expect(result).toBeNull()
    })

    it("should return progress when exists", async () => {
      const now = new Date()
      db.insert(schema.userTopicProgress)
        .values({
          id: "progress-1",
          userId,
          topicId,
          understood: true,
          lastAccessedAt: now,
          questionCount: 5,
          goodQuestionCount: 3,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const result = await repository.findProgress(userId, topicId)

      expect(result).not.toBeNull()
      expect(result?.id).toBe("progress-1")
      expect(result?.userId).toBe(userId)
      expect(result?.topicId).toBe(topicId)
      expect(result?.understood).toBe(true)
      expect(result?.questionCount).toBe(5)
      expect(result?.goodQuestionCount).toBe(3)
    })

    it("should not return progress for different user", async () => {
      const now = new Date()
      db.insert(schema.userTopicProgress)
        .values({
          id: "progress-1",
          userId: otherUserId,
          topicId,
          understood: false,
          questionCount: 0,
          goodQuestionCount: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const result = await repository.findProgress(userId, topicId)

      expect(result).toBeNull()
    })
  })

  describe("upsertProgress", () => {
    it("should create new progress when not exists", async () => {
      const result = await repository.upsertProgress(userId, {
        userId,
        topicId,
        understood: true,
      })

      expect(result.id).toBeDefined()
      expect(result.userId).toBe(userId)
      expect(result.topicId).toBe(topicId)
      expect(result.understood).toBe(true)
      expect(result.questionCount).toBe(0)
      expect(result.goodQuestionCount).toBe(0)
      expect(result.lastAccessedAt).toBeInstanceOf(Date)
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)

      // Verify it was persisted
      const found = await repository.findProgress(userId, topicId)
      expect(found?.understood).toBe(true)
    })

    it("should update existing progress", async () => {
      const oldTime = new Date("2024-01-01")
      db.insert(schema.userTopicProgress)
        .values({
          id: "progress-1",
          userId,
          topicId,
          understood: false,
          lastAccessedAt: oldTime,
          questionCount: 2,
          goodQuestionCount: 1,
          createdAt: oldTime,
          updatedAt: oldTime,
        })
        .run()

      const result = await repository.upsertProgress(userId, {
        userId,
        topicId,
        understood: true,
      })

      expect(result.id).toBe("progress-1")
      expect(result.understood).toBe(true)
      expect(result.questionCount).toBe(2) // unchanged
      expect(result.goodQuestionCount).toBe(1) // unchanged
      expect(result.updatedAt.getTime()).toBeGreaterThan(oldTime.getTime())
    })

    it("should increment questionCount when specified", async () => {
      const now = new Date()
      db.insert(schema.userTopicProgress)
        .values({
          id: "progress-1",
          userId,
          topicId,
          understood: false,
          questionCount: 5,
          goodQuestionCount: 2,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const result = await repository.upsertProgress(userId, {
        userId,
        topicId,
        incrementQuestionCount: true,
      })

      expect(result.questionCount).toBe(6)
      expect(result.goodQuestionCount).toBe(2) // unchanged
    })

    it("should increment goodQuestionCount when specified", async () => {
      const now = new Date()
      db.insert(schema.userTopicProgress)
        .values({
          id: "progress-1",
          userId,
          topicId,
          understood: false,
          questionCount: 5,
          goodQuestionCount: 2,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const result = await repository.upsertProgress(userId, {
        userId,
        topicId,
        incrementGoodQuestionCount: true,
      })

      expect(result.questionCount).toBe(5) // unchanged
      expect(result.goodQuestionCount).toBe(3)
    })

    it("should create with incremented counts when no existing progress", async () => {
      const result = await repository.upsertProgress(userId, {
        userId,
        topicId,
        incrementQuestionCount: true,
        incrementGoodQuestionCount: true,
      })

      expect(result.questionCount).toBe(1)
      expect(result.goodQuestionCount).toBe(1)
    })
  })

  describe("findProgressByUser", () => {
    it("should return empty array when no progress exists", async () => {
      const result = await repository.findProgressByUser(userId)

      expect(result).toHaveLength(0)
    })

    it("should return all progress for user", async () => {
      const now = new Date()

      // Create another topic
      db.insert(schema.topics)
        .values({ id: "topic-2", userId, categoryId, name: "Topic 2", displayOrder: 1, createdAt: now, updatedAt: now })
        .run()

      // Create progress for multiple topics
      db.insert(schema.userTopicProgress)
        .values([
          { id: "progress-1", userId, topicId, understood: true, questionCount: 3, goodQuestionCount: 1, createdAt: now, updatedAt: now },
          { id: "progress-2", userId, topicId: "topic-2", understood: false, questionCount: 1, goodQuestionCount: 0, createdAt: now, updatedAt: now },
        ])
        .run()

      const result = await repository.findProgressByUser(userId)

      expect(result).toHaveLength(2)
    })

    it("should not include other users progress", async () => {
      const now = new Date()

      // Create progress for both users
      db.insert(schema.userTopicProgress)
        .values([
          { id: "progress-1", userId, topicId, understood: true, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
          { id: "progress-2", userId: otherUserId, topicId, understood: false, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
        ])
        .run()

      const result = await repository.findProgressByUser(userId)

      expect(result).toHaveLength(1)
      expect(result[0].userId).toBe(userId)
    })
  })

  describe("findRecentTopics", () => {
    it("should return recent topics with joins", async () => {
      const now = new Date()
      db.insert(schema.userTopicProgress)
        .values({ id: "progress-1", userId, topicId, understood: false, lastAccessedAt: now, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now })
        .run()

      const result = await repository.findRecentTopics(userId, 10)

      expect(result).toHaveLength(1)
      expect(result[0].topicId).toBe(topicId)
      expect(result[0].topicName).toBe("Test Topic")
      expect(result[0].subjectId).toBe(subjectId)
      expect(result[0].subjectName).toBe("Test Subject")
      expect(result[0].categoryId).toBe(categoryId)
      expect(result[0].lastAccessedAt).toBeInstanceOf(Date)
    })

    it("should respect limit", async () => {
      const now = new Date()

      // Create multiple topics
      db.insert(schema.topics)
        .values([
          { id: "topic-2", userId, categoryId, name: "Topic 2", displayOrder: 1, createdAt: now, updatedAt: now },
          { id: "topic-3", userId, categoryId, name: "Topic 3", displayOrder: 2, createdAt: now, updatedAt: now },
        ])
        .run()

      // Create progress for all
      db.insert(schema.userTopicProgress)
        .values([
          { id: "progress-1", userId, topicId, lastAccessedAt: new Date("2024-01-01"), questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
          { id: "progress-2", userId, topicId: "topic-2", lastAccessedAt: new Date("2024-01-02"), questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
          { id: "progress-3", userId, topicId: "topic-3", lastAccessedAt: new Date("2024-01-03"), questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
        ])
        .run()

      const result = await repository.findRecentTopics(userId, 2)

      expect(result).toHaveLength(2)
      // Should be ordered by lastAccessedAt desc
      expect(result[0].topicName).toBe("Topic 3")
      expect(result[1].topicName).toBe("Topic 2")
    })

    it("should exclude soft-deleted topics", async () => {
      const now = new Date()

      // Create a deleted topic
      db.insert(schema.topics)
        .values({ id: "deleted-topic", userId, categoryId, name: "Deleted Topic", displayOrder: 1, createdAt: now, updatedAt: now, deletedAt: now })
        .run()

      db.insert(schema.userTopicProgress)
        .values([
          { id: "progress-1", userId, topicId, lastAccessedAt: now, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
          { id: "progress-2", userId, topicId: "deleted-topic", lastAccessedAt: now, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
        ])
        .run()

      const result = await repository.findRecentTopics(userId, 10)

      expect(result).toHaveLength(1)
      expect(result[0].topicId).toBe(topicId)
    })

    it("should exclude topics with soft-deleted categories", async () => {
      const now = new Date()

      // Create a deleted category with a topic
      db.insert(schema.categories)
        .values({ id: "deleted-cat", userId, subjectId, name: "Deleted Category", depth: 0, displayOrder: 1, createdAt: now, updatedAt: now, deletedAt: now })
        .run()
      db.insert(schema.topics)
        .values({ id: "orphaned-topic", userId, categoryId: "deleted-cat", name: "Orphaned Topic", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()

      db.insert(schema.userTopicProgress)
        .values([
          { id: "progress-1", userId, topicId, lastAccessedAt: now, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
          { id: "progress-2", userId, topicId: "orphaned-topic", lastAccessedAt: now, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
        ])
        .run()

      const result = await repository.findRecentTopics(userId, 10)

      expect(result).toHaveLength(1)
      expect(result[0].topicId).toBe(topicId)
    })

    it("should exclude topics with soft-deleted subjects", async () => {
      const now = new Date()

      // Create a deleted subject with category and topic
      db.insert(schema.subjects)
        .values({ id: "deleted-subj", userId, studyDomainId, name: "Deleted Subject", displayOrder: 1, createdAt: now, updatedAt: now, deletedAt: now })
        .run()
      db.insert(schema.categories)
        .values({ id: "orphaned-cat", userId, subjectId: "deleted-subj", name: "Orphaned Category", depth: 0, displayOrder: 0, createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.topics)
        .values({ id: "orphaned-topic", userId, categoryId: "orphaned-cat", name: "Orphaned Topic", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()

      db.insert(schema.userTopicProgress)
        .values([
          { id: "progress-1", userId, topicId, lastAccessedAt: now, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
          { id: "progress-2", userId, topicId: "orphaned-topic", lastAccessedAt: now, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
        ])
        .run()

      const result = await repository.findRecentTopics(userId, 10)

      expect(result).toHaveLength(1)
      expect(result[0].topicId).toBe(topicId)
    })

    it("should exclude topics with soft-deleted study domains", async () => {
      const now = new Date()

      // Create a deleted study domain with full hierarchy
      db.insert(schema.studyDomains)
        .values({ id: "deleted-domain", userId, name: "Deleted Domain", createdAt: now, updatedAt: now, deletedAt: now })
        .run()
      db.insert(schema.subjects)
        .values({ id: "orphaned-subj", userId, studyDomainId: "deleted-domain", name: "Orphaned Subject", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.categories)
        .values({ id: "orphaned-cat", userId, subjectId: "orphaned-subj", name: "Orphaned Category", depth: 0, displayOrder: 0, createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.topics)
        .values({ id: "orphaned-topic", userId, categoryId: "orphaned-cat", name: "Orphaned Topic", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()

      db.insert(schema.userTopicProgress)
        .values([
          { id: "progress-1", userId, topicId, lastAccessedAt: now, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
          { id: "progress-2", userId, topicId: "orphaned-topic", lastAccessedAt: now, questionCount: 0, goodQuestionCount: 0, createdAt: now, updatedAt: now },
        ])
        .run()

      const result = await repository.findRecentTopics(userId, 10)

      expect(result).toHaveLength(1)
      expect(result[0].topicId).toBe(topicId)
    })
  })

  describe("touchTopic", () => {
    it("should create progress if not exists", async () => {
      const result = await repository.touchTopic(userId, topicId)

      expect(result.id).toBeDefined()
      expect(result.userId).toBe(userId)
      expect(result.topicId).toBe(topicId)
      expect(result.understood).toBe(false)
      expect(result.questionCount).toBe(0)
      expect(result.goodQuestionCount).toBe(0)
      expect(result.lastAccessedAt).toBeInstanceOf(Date)

      // Verify persisted
      const found = await repository.findProgress(userId, topicId)
      expect(found).not.toBeNull()
    })

    it("should update lastAccessedAt if exists", async () => {
      const oldTime = new Date("2024-01-01")
      db.insert(schema.userTopicProgress)
        .values({
          id: "progress-1",
          userId,
          topicId,
          understood: true,
          lastAccessedAt: oldTime,
          questionCount: 5,
          goodQuestionCount: 3,
          createdAt: oldTime,
          updatedAt: oldTime,
        })
        .run()

      const result = await repository.touchTopic(userId, topicId)

      expect(result.id).toBe("progress-1")
      expect(result.understood).toBe(true) // unchanged
      expect(result.questionCount).toBe(5) // unchanged
      expect(result.goodQuestionCount).toBe(3) // unchanged
      expect(result.lastAccessedAt!.getTime()).toBeGreaterThan(oldTime.getTime())
      expect(result.updatedAt.getTime()).toBeGreaterThan(oldTime.getTime())
    })
  })

  describe("createCheckHistory", () => {
    it("should create check history record for checked action", async () => {
      const result = await repository.createCheckHistory(userId, {
        userId,
        topicId,
        action: "checked",
      })

      expect(result.id).toBeDefined()
      expect(result.userId).toBe(userId)
      expect(result.topicId).toBe(topicId)
      expect(result.action).toBe("checked")
      expect(result.checkedAt).toBeInstanceOf(Date)
    })

    it("should create check history record for unchecked action", async () => {
      const result = await repository.createCheckHistory(userId, {
        userId,
        topicId,
        action: "unchecked",
      })

      expect(result.id).toBeDefined()
      expect(result.action).toBe("unchecked")
    })
  })

  describe("findCheckHistoryByTopic", () => {
    it("should return empty array when no history exists", async () => {
      const result = await repository.findCheckHistoryByTopic(userId, topicId)

      expect(result).toHaveLength(0)
    })

    it("should return history ordered by checkedAt desc", async () => {
      // Create history records with sufficient delay to ensure different timestamps
      await repository.createCheckHistory(userId, { userId, topicId, action: "checked" })
      await new Promise((r) => setTimeout(r, 50))
      await repository.createCheckHistory(userId, { userId, topicId, action: "unchecked" })
      await new Promise((r) => setTimeout(r, 50))
      await repository.createCheckHistory(userId, { userId, topicId, action: "checked" })

      const result = await repository.findCheckHistoryByTopic(userId, topicId)

      expect(result).toHaveLength(3)
      // Most recent first (last inserted = checked, middle = unchecked, first inserted = checked)
      expect(result[0].action).toBe("checked")
      expect(result[1].action).toBe("unchecked")
      expect(result[2].action).toBe("checked")
      // Verify ordering - most recent timestamps first
      expect(result[0].checkedAt.getTime()).toBeGreaterThanOrEqual(result[1].checkedAt.getTime())
      expect(result[1].checkedAt.getTime()).toBeGreaterThanOrEqual(result[2].checkedAt.getTime())
    })

    it("should not return other users history", async () => {
      await repository.createCheckHistory(userId, { userId, topicId, action: "checked" })
      await repository.createCheckHistory(otherUserId, { userId: otherUserId, topicId, action: "checked" })

      const result = await repository.findCheckHistoryByTopic(userId, topicId)

      expect(result).toHaveLength(1)
      expect(result[0].userId).toBe(userId)
    })
  })

  describe("verifyTopicExists", () => {
    it("should return true for valid topic owned by user", async () => {
      const result = await repository.verifyTopicExists(userId, topicId)

      expect(result).toBe(true)
    })

    it("should return false for non-existent topic", async () => {
      const result = await repository.verifyTopicExists(userId, "non-existent")

      expect(result).toBe(false)
    })

    it("should return false for topic owned by different user", async () => {
      // Create topic owned by other user
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "other-domain", userId: otherUserId, name: "Other Domain", createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.subjects)
        .values({ id: "other-subject", userId: otherUserId, studyDomainId: "other-domain", name: "Other Subject", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.categories)
        .values({ id: "other-category", userId: otherUserId, subjectId: "other-subject", name: "Other Category", depth: 0, displayOrder: 0, createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.topics)
        .values({ id: "other-topic", userId: otherUserId, categoryId: "other-category", name: "Other Topic", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()

      const result = await repository.verifyTopicExists(userId, "other-topic")

      expect(result).toBe(false)
    })

    it("should return false for soft-deleted topic", async () => {
      const now = new Date()
      db.insert(schema.topics)
        .values({ id: "deleted-topic", userId, categoryId, name: "Deleted Topic", displayOrder: 1, createdAt: now, updatedAt: now, deletedAt: now })
        .run()

      const result = await repository.verifyTopicExists(userId, "deleted-topic")

      expect(result).toBe(false)
    })

    it("should return false for topic with soft-deleted category", async () => {
      const now = new Date()
      db.insert(schema.categories)
        .values({ id: "deleted-cat", userId, subjectId, name: "Deleted Category", depth: 0, displayOrder: 1, createdAt: now, updatedAt: now, deletedAt: now })
        .run()
      db.insert(schema.topics)
        .values({ id: "orphaned-topic", userId, categoryId: "deleted-cat", name: "Orphaned Topic", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()

      const result = await repository.verifyTopicExists(userId, "orphaned-topic")

      expect(result).toBe(false)
    })

    it("should return false for topic with soft-deleted subject", async () => {
      const now = new Date()
      db.insert(schema.subjects)
        .values({ id: "deleted-subj", userId, studyDomainId, name: "Deleted Subject", displayOrder: 1, createdAt: now, updatedAt: now, deletedAt: now })
        .run()
      db.insert(schema.categories)
        .values({ id: "orphaned-cat", userId, subjectId: "deleted-subj", name: "Orphaned Category", depth: 0, displayOrder: 0, createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.topics)
        .values({ id: "orphaned-topic", userId, categoryId: "orphaned-cat", name: "Orphaned Topic", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()

      const result = await repository.verifyTopicExists(userId, "orphaned-topic")

      expect(result).toBe(false)
    })

    it("should return false for topic with soft-deleted study domain", async () => {
      const now = new Date()
      db.insert(schema.studyDomains)
        .values({ id: "deleted-domain", userId, name: "Deleted Domain", createdAt: now, updatedAt: now, deletedAt: now })
        .run()
      db.insert(schema.subjects)
        .values({ id: "orphaned-subj", userId, studyDomainId: "deleted-domain", name: "Orphaned Subject", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.categories)
        .values({ id: "orphaned-cat", userId, subjectId: "orphaned-subj", name: "Orphaned Category", depth: 0, displayOrder: 0, createdAt: now, updatedAt: now })
        .run()
      db.insert(schema.topics)
        .values({ id: "orphaned-topic", userId, categoryId: "orphaned-cat", name: "Orphaned Topic", displayOrder: 0, createdAt: now, updatedAt: now })
        .run()

      const result = await repository.verifyTopicExists(userId, "orphaned-topic")

      expect(result).toBe(false)
    })
  })
})
