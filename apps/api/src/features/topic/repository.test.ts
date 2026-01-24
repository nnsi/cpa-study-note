import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, seedTestData } from "../../test/mocks/db"
import { createTopicRepository, type TopicRepository } from "./repository"
import * as schema from "@cpa-study/db/schema"

describe("TopicRepository", () => {
  let repository: TopicRepository
  let testData: ReturnType<typeof seedTestData>
  let db: ReturnType<typeof createTestDatabase>["db"]

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    testData = seedTestData(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createTopicRepository(db as any)
  })

  describe("findAllSubjects", () => {
    it("should return all subjects", async () => {
      const subjects = await repository.findAllSubjects()

      expect(subjects.length).toBeGreaterThanOrEqual(1)
      expect(subjects.some((s) => s.id === testData.subjectId)).toBe(true)
    })

    it("should return subjects ordered by displayOrder", async () => {
      const now = new Date()
      // 追加の科目を作成
      db.insert(schema.subjects)
        .values({
          id: "subject-2",
          name: "管理会計論",
          description: "管理会計論の科目",
          displayOrder: 0, // 先に表示される
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const subjects = await repository.findAllSubjects()

      expect(subjects[0].displayOrder).toBeLessThanOrEqual(
        subjects[1].displayOrder
      )
    })
  })

  describe("findSubjectById", () => {
    it("should return subject when exists", async () => {
      const subject = await repository.findSubjectById(testData.subjectId)

      expect(subject).not.toBeNull()
      expect(subject?.id).toBe(testData.subjectId)
      expect(subject?.name).toBe("財務会計論")
    })

    it("should return null when subject does not exist", async () => {
      const subject = await repository.findSubjectById("non-existent")

      expect(subject).toBeNull()
    })
  })

  describe("findCategoriesBySubjectId", () => {
    it("should return categories for subject", async () => {
      const categories = await repository.findCategoriesBySubjectId(
        testData.subjectId
      )

      expect(categories.length).toBeGreaterThanOrEqual(1)
      expect(categories.some((c) => c.id === testData.categoryId)).toBe(true)
      categories.forEach((cat) => {
        expect(cat.subjectId).toBe(testData.subjectId)
      })
    })

    it("should return categories ordered by depth and displayOrder", async () => {
      const now = new Date()
      // 追加のカテゴリを作成
      db.insert(schema.categories)
        .values({
          id: "category-2",
          subjectId: testData.subjectId,
          name: "理論",
          depth: 0,
          parentId: null,
          displayOrder: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run()
      db.insert(schema.categories)
        .values({
          id: "category-3",
          subjectId: testData.subjectId,
          name: "子カテゴリ",
          depth: 1,
          parentId: testData.categoryId,
          displayOrder: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const categories = await repository.findCategoriesBySubjectId(
        testData.subjectId
      )

      // depth順でソートされている
      for (let i = 0; i < categories.length - 1; i++) {
        expect(categories[i].depth).toBeLessThanOrEqual(categories[i + 1].depth)
      }
    })

    it("should return empty array when subject has no categories", async () => {
      const now = new Date()
      db.insert(schema.subjects)
        .values({
          id: "empty-subject",
          name: "空の科目",
          displayOrder: 99,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const categories =
        await repository.findCategoriesBySubjectId("empty-subject")

      expect(categories).toHaveLength(0)
    })
  })

  describe("findTopicsByCategoryId", () => {
    it("should return topics for category", async () => {
      const topics = await repository.findTopicsByCategoryId(
        testData.categoryId
      )

      expect(topics.length).toBeGreaterThanOrEqual(1)
      expect(topics.some((t) => t.id === testData.topicId)).toBe(true)
      topics.forEach((topic) => {
        expect(topic.categoryId).toBe(testData.categoryId)
      })
    })

    it("should return topics ordered by displayOrder", async () => {
      const now = new Date()
      // 追加の論点を作成
      db.insert(schema.topics)
        .values({
          id: "topic-2",
          categoryId: testData.categoryId,
          name: "棚卸資産",
          description: "棚卸資産の会計処理",
          displayOrder: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const topics = await repository.findTopicsByCategoryId(
        testData.categoryId
      )

      for (let i = 0; i < topics.length - 1; i++) {
        expect(topics[i].displayOrder).toBeLessThanOrEqual(
          topics[i + 1].displayOrder
        )
      }
    })

    it("should return empty array when category has no topics", async () => {
      const now = new Date()
      db.insert(schema.categories)
        .values({
          id: "empty-category",
          subjectId: testData.subjectId,
          name: "空のカテゴリ",
          depth: 0,
          displayOrder: 99,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const topics = await repository.findTopicsByCategoryId("empty-category")

      expect(topics).toHaveLength(0)
    })
  })

  describe("findTopicById", () => {
    it("should return topic when exists", async () => {
      const topic = await repository.findTopicById(testData.topicId)

      expect(topic).not.toBeNull()
      expect(topic?.id).toBe(testData.topicId)
      expect(topic?.name).toBe("有価証券")
      expect(topic?.description).toBe("有価証券の評価と会計処理")
    })

    it("should return null when topic does not exist", async () => {
      const topic = await repository.findTopicById("non-existent")

      expect(topic).toBeNull()
    })
  })

  describe("findProgress", () => {
    it("should return progress when exists", async () => {
      // 進捗を作成
      await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
        understood: true,
      })

      const progress = await repository.findProgress(
        testData.userId,
        testData.topicId
      )

      expect(progress).not.toBeNull()
      expect(progress?.userId).toBe(testData.userId)
      expect(progress?.topicId).toBe(testData.topicId)
      expect(progress?.understood).toBe(true)
    })

    it("should return null when progress does not exist", async () => {
      const progress = await repository.findProgress(
        testData.userId,
        "non-existent-topic"
      )

      expect(progress).toBeNull()
    })
  })

  describe("upsertProgress", () => {
    it("should create new progress when not exists", async () => {
      const progress = await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
        understood: false,
      })

      expect(progress.id).toBeDefined()
      expect(progress.userId).toBe(testData.userId)
      expect(progress.topicId).toBe(testData.topicId)
      expect(progress.understood).toBe(false)
      expect(progress.questionCount).toBe(0)
      expect(progress.goodQuestionCount).toBe(0)
    })

    it("should update existing progress", async () => {
      // 最初の進捗を作成
      await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
        understood: false,
      })

      // 更新
      const updated = await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
        understood: true,
      })

      expect(updated.understood).toBe(true)
    })

    it("should increment questionCount when specified", async () => {
      // 最初の進捗を作成
      await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      // 質問数をインクリメント
      const updated = await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
        incrementQuestionCount: true,
      })

      expect(updated.questionCount).toBe(1)

      // もう一度インクリメント
      const updated2 = await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
        incrementQuestionCount: true,
      })

      expect(updated2.questionCount).toBe(2)
    })

    it("should increment goodQuestionCount when specified", async () => {
      // 最初の進捗を作成
      await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      // 良い質問数をインクリメント
      const updated = await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
        incrementGoodQuestionCount: true,
      })

      expect(updated.goodQuestionCount).toBe(1)
    })

    it("should create progress with questionCount=1 when incrementQuestionCount on new record", async () => {
      const progress = await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
        incrementQuestionCount: true,
      })

      expect(progress.questionCount).toBe(1)
    })
  })

  describe("findProgressByUser", () => {
    it("should return all progress for user", async () => {
      // 複数の論点の進捗を作成
      await repository.upsertProgress({
        userId: testData.userId,
        topicId: testData.topicId,
        understood: true,
      })

      const now = new Date()
      db.insert(schema.topics)
        .values({
          id: "topic-another",
          categoryId: testData.categoryId,
          name: "別の論点",
          displayOrder: 10,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      await repository.upsertProgress({
        userId: testData.userId,
        topicId: "topic-another",
        understood: false,
      })

      const progressList = await repository.findProgressByUser(testData.userId)

      expect(progressList.length).toBe(2)
      progressList.forEach((p) => {
        expect(p.userId).toBe(testData.userId)
      })
    })

    it("should return empty array when user has no progress", async () => {
      const progressList = await repository.findProgressByUser("new-user")

      expect(progressList).toHaveLength(0)
    })
  })

  describe("getSubjectStats", () => {
    it("should return category and topic counts", async () => {
      const stats = await repository.getSubjectStats(testData.subjectId)

      expect(stats.categoryCount).toBeGreaterThanOrEqual(1)
      expect(stats.topicCount).toBeGreaterThanOrEqual(1)
    })

    it("should return zero counts for subject with no content", async () => {
      const now = new Date()
      db.insert(schema.subjects)
        .values({
          id: "empty-subject-2",
          name: "空の科目2",
          displayOrder: 100,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const stats = await repository.getSubjectStats("empty-subject-2")

      expect(stats.categoryCount).toBe(0)
      expect(stats.topicCount).toBe(0)
    })

    it("should count topics correctly across multiple categories", async () => {
      const now = new Date()
      // 新しいカテゴリと論点を追加
      db.insert(schema.categories)
        .values({
          id: "category-stats",
          subjectId: testData.subjectId,
          name: "統計用カテゴリ",
          depth: 0,
          displayOrder: 10,
          createdAt: now,
          updatedAt: now,
        })
        .run()
      db.insert(schema.topics)
        .values({
          id: "topic-stats-1",
          categoryId: "category-stats",
          name: "統計用論点1",
          displayOrder: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run()
      db.insert(schema.topics)
        .values({
          id: "topic-stats-2",
          categoryId: "category-stats",
          name: "統計用論点2",
          displayOrder: 1,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const stats = await repository.getSubjectStats(testData.subjectId)

      // 元々のカテゴリ + 新しいカテゴリ = 2
      expect(stats.categoryCount).toBe(2)
      // 元々の論点 + 新しい論点2つ = 3
      expect(stats.topicCount).toBe(3)
    })
  })
})
