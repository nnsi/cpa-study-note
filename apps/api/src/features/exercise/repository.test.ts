import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, seedTestData } from "../../test/mocks/db"
import { createExerciseRepository, type ExerciseRepository } from "./repository"
import { createImageRepository, type ImageRepository } from "../image/repository"

describe("ExerciseRepository", () => {
  let exerciseRepo: ExerciseRepository
  let imageRepo: ImageRepository
  let testData: ReturnType<typeof seedTestData>
  let testImageId: string

  beforeEach(async () => {
    const { db } = createTestDatabase()
    testData = seedTestData(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exerciseRepo = createExerciseRepository(db as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    imageRepo = createImageRepository(db as any)

    // テスト用の画像を作成
    testImageId = "test-image-1"
    await imageRepo.create({
      id: testImageId,
      userId: testData.userId,
      filename: "test.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      r2Key: "images/test-image-1/test.jpg",
      ocrText: "問1 A社はB社株式の30%を取得した",
    })
  })

  describe("create", () => {
    it("should create an exercise", async () => {
      const exercise = await exerciseRepo.create({
        id: "exercise-1",
        userId: testData.userId,
        imageId: testImageId,
        suggestedTopicIds: [testData.topicId],
      })

      expect(exercise.id).toBe("exercise-1")
      expect(exercise.userId).toBe(testData.userId)
      expect(exercise.imageId).toBe(testImageId)
      expect(exercise.topicId).toBeNull()
      expect(exercise.suggestedTopicIds).toEqual([testData.topicId])
      expect(exercise.markedAsUnderstood).toBe(false)
      expect(exercise.createdAt).toBeInstanceOf(Date)
      expect(exercise.confirmedAt).toBeNull()
    })

    it("should store multiple suggested topic IDs", async () => {
      const topicIds = ["topic-a", "topic-b", "topic-c"]
      const exercise = await exerciseRepo.create({
        id: "exercise-2",
        userId: testData.userId,
        imageId: testImageId,
        suggestedTopicIds: topicIds,
      })

      expect(exercise.suggestedTopicIds).toEqual(topicIds)
    })
  })

  describe("findById", () => {
    it("should find exercise by ID", async () => {
      await exerciseRepo.create({
        id: "exercise-find",
        userId: testData.userId,
        imageId: testImageId,
        suggestedTopicIds: [testData.topicId],
      })

      const found = await exerciseRepo.findById("exercise-find")

      expect(found).not.toBeNull()
      expect(found?.id).toBe("exercise-find")
    })

    it("should return null for non-existent exercise", async () => {
      const found = await exerciseRepo.findById("non-existent")
      expect(found).toBeNull()
    })
  })

  describe("findByIdWithOwnerCheck", () => {
    it("should find exercise for correct user", async () => {
      await exerciseRepo.create({
        id: "exercise-owner",
        userId: testData.userId,
        imageId: testImageId,
        suggestedTopicIds: [],
      })

      const found = await exerciseRepo.findByIdWithOwnerCheck(
        "exercise-owner",
        testData.userId
      )

      expect(found).not.toBeNull()
      expect(found?.id).toBe("exercise-owner")
    })

    it("should return null for different user", async () => {
      await exerciseRepo.create({
        id: "exercise-other",
        userId: testData.userId,
        imageId: testImageId,
        suggestedTopicIds: [],
      })

      const found = await exerciseRepo.findByIdWithOwnerCheck(
        "exercise-other",
        "other-user-id"
      )

      expect(found).toBeNull()
    })
  })

  describe("confirm", () => {
    it("should confirm exercise with topic", async () => {
      await exerciseRepo.create({
        id: "exercise-confirm",
        userId: testData.userId,
        imageId: testImageId,
        suggestedTopicIds: [testData.topicId],
      })

      const confirmed = await exerciseRepo.confirm(
        "exercise-confirm",
        testData.topicId,
        false
      )

      expect(confirmed).not.toBeNull()
      expect(confirmed?.topicId).toBe(testData.topicId)
      expect(confirmed?.markedAsUnderstood).toBe(false)
      expect(confirmed?.confirmedAt).toBeInstanceOf(Date)
    })

    it("should mark as understood when specified", async () => {
      await exerciseRepo.create({
        id: "exercise-understood",
        userId: testData.userId,
        imageId: testImageId,
        suggestedTopicIds: [],
      })

      const confirmed = await exerciseRepo.confirm(
        "exercise-understood",
        testData.topicId,
        true
      )

      expect(confirmed?.markedAsUnderstood).toBe(true)
    })
  })

  describe("findByTopicId", () => {
    it("should find exercises for a topic", async () => {
      // 2つの確定済みexerciseを作成
      await exerciseRepo.create({
        id: "exercise-topic-1",
        userId: testData.userId,
        imageId: testImageId,
        suggestedTopicIds: [],
      })
      await exerciseRepo.confirm("exercise-topic-1", testData.topicId, true)

      // 2つ目の画像とexercise
      const imageId2 = "test-image-2"
      await imageRepo.create({
        id: imageId2,
        userId: testData.userId,
        filename: "test2.jpg",
        mimeType: "image/jpeg",
        size: 2048,
        r2Key: "images/test-image-2/test2.jpg",
        ocrText: "問2 関連会社の判定",
      })
      await exerciseRepo.create({
        id: "exercise-topic-2",
        userId: testData.userId,
        imageId: imageId2,
        suggestedTopicIds: [],
      })
      await exerciseRepo.confirm("exercise-topic-2", testData.topicId, false)

      const exercises = await exerciseRepo.findByTopicId(
        testData.topicId,
        testData.userId
      )

      expect(exercises).toHaveLength(2)
      expect(exercises[0].ocrText).toBeDefined()
    })

    it("should return empty array for topic with no exercises", async () => {
      const exercises = await exerciseRepo.findByTopicId(
        testData.topicId,
        testData.userId
      )

      expect(exercises).toHaveLength(0)
    })
  })

  describe("findTopicsForSuggestion", () => {
    it("should return topics for the user", async () => {
      const topics = await exerciseRepo.findTopicsForSuggestion(testData.userId)

      expect(topics.length).toBeGreaterThan(0)
      expect(topics[0]).toHaveProperty("id")
      expect(topics[0]).toHaveProperty("name")
      expect(topics[0]).toHaveProperty("subjectName")
    })

    it("should return empty array for user with no topics", async () => {
      const topics = await exerciseRepo.findTopicsForSuggestion("non-existent-user")

      expect(topics).toHaveLength(0)
    })
  })
})
