import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, seedTestData } from "../../test/mocks/db"
import { createNoteRepository, type NoteRepository } from "./repository"
import { createChatRepository } from "../chat/repository"
import * as schema from "@cpa-study/db/schema"

describe("NoteRepository", () => {
  let repository: NoteRepository
  let testData: ReturnType<typeof seedTestData>
  let db: ReturnType<typeof createTestDatabase>["db"]

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    testData = seedTestData(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createNoteRepository(db as any)
  })

  describe("create", () => {
    it("should create note with all fields", async () => {
      const noteData = {
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "AI generated summary",
        userMemo: "User memo content",
        keyPoints: ["Point 1", "Point 2"],
        stumbledPoints: ["Stumbled on X"],
      }

      const note = await repository.create(noteData)

      expect(note.id).toBeDefined()
      expect(note.userId).toBe(testData.userId)
      expect(note.topicId).toBe(testData.topicId)
      expect(note.aiSummary).toBe("AI generated summary")
      expect(note.userMemo).toBe("User memo content")
      expect(note.keyPoints).toEqual(["Point 1", "Point 2"])
      expect(note.stumbledPoints).toEqual(["Stumbled on X"])
      expect(note.createdAt).toBeInstanceOf(Date)
      expect(note.updatedAt).toBeInstanceOf(Date)
    })

    it("should create note with session reference", async () => {
      // セッションを作成
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chatRepo = createChatRepository(db as any)
      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const note = await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: session.id,
        aiSummary: null,
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
      })

      expect(note.sessionId).toBe(session.id)
    })

    it("should create note with empty arrays", async () => {
      const note = await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: null,
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
      })

      expect(note.keyPoints).toEqual([])
      expect(note.stumbledPoints).toEqual([])
    })
  })

  describe("findById", () => {
    it("should return note when exists", async () => {
      const created = await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "Summary",
        userMemo: "Memo",
        keyPoints: ["Key 1"],
        stumbledPoints: [],
      })

      const found = await repository.findById(created.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.aiSummary).toBe("Summary")
      expect(found?.keyPoints).toEqual(["Key 1"])
    })

    it("should return null when note does not exist", async () => {
      const found = await repository.findById("non-existent-id")

      expect(found).toBeNull()
    })

    it("should handle notes with null keyPoints gracefully", async () => {
      // 直接DBに挿入してnullの場合をテスト
      const now = new Date()
      db.insert(schema.notes)
        .values({
          id: "note-null-arrays",
          userId: testData.userId,
          topicId: testData.topicId,
          sessionId: null,
          aiSummary: null,
          userMemo: null,
          keyPoints: null as unknown as string[], // SQLiteでnullを許容
          stumbledPoints: null as unknown as string[],
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const found = await repository.findById("note-null-arrays")

      expect(found).not.toBeNull()
      expect(found?.keyPoints).toEqual([])
      expect(found?.stumbledPoints).toEqual([])
    })
  })

  describe("findByIdWithTopic", () => {
    it("should return note with topic details", async () => {
      const created = await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "With topic",
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
      })

      const found = await repository.findByIdWithTopic(created.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.topicName).toBe("有価証券")
      expect(found?.categoryId).toBe(testData.categoryId)
      expect(found?.subjectId).toBe(testData.subjectId)
      expect(found?.subjectName).toBe("財務会計論")
    })

    it("should return null when note does not exist", async () => {
      const found = await repository.findByIdWithTopic("non-existent-id")

      expect(found).toBeNull()
    })
  })

  describe("findByTopic", () => {
    it("should return notes for user and topic", async () => {
      // 同じトピックで複数のノートを作成
      await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "Note 1",
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
      })
      await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "Note 2",
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
      })

      const notes = await repository.findByTopic(
        testData.userId,
        testData.topicId
      )

      expect(notes).toHaveLength(2)
      notes.forEach((note) => {
        expect(note.userId).toBe(testData.userId)
        expect(note.topicId).toBe(testData.topicId)
      })
    })

    it("should return notes ordered by createdAt desc", async () => {
      await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "First",
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
      })
      await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "Second",
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
      })

      const notes = await repository.findByTopic(
        testData.userId,
        testData.topicId
      )

      // 2つのノートが取得でき、createdAtが降順になっていることを確認
      expect(notes).toHaveLength(2)
      expect(notes[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        notes[1].createdAt.getTime()
      )
    })

    it("should return empty array when no notes exist", async () => {
      const notes = await repository.findByTopic(
        testData.userId,
        "non-existent-topic"
      )

      expect(notes).toHaveLength(0)
    })
  })

  describe("findByUser", () => {
    it("should return notes with topic info for user", async () => {
      await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "User note",
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
      })

      const notes = await repository.findByUser(testData.userId)

      expect(notes.length).toBeGreaterThanOrEqual(1)
      const note = notes[0]
      expect(note.userId).toBe(testData.userId)
      expect(note.topicName).toBe("有価証券")
      expect(note.subjectName).toBe("財務会計論")
    })

    it("should return notes ordered by createdAt desc", async () => {
      await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "First",
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
      })
      await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "Second",
        userMemo: null,
        keyPoints: [],
        stumbledPoints: [],
      })

      const notes = await repository.findByUser(testData.userId)

      // 2つのノートが取得でき、createdAtが降順になっていることを確認
      expect(notes).toHaveLength(2)
      expect(notes[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        notes[1].createdAt.getTime()
      )
    })

    it("should return empty array when user has no notes", async () => {
      const notes = await repository.findByUser("user-with-no-notes")

      expect(notes).toHaveLength(0)
    })
  })

  describe("update", () => {
    it("should update userMemo", async () => {
      const created = await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: null,
        userMemo: "Original memo",
        keyPoints: [],
        stumbledPoints: [],
      })

      const updated = await repository.update(created.id, {
        userMemo: "Updated memo",
      })

      expect(updated).not.toBeNull()
      expect(updated?.userMemo).toBe("Updated memo")
      // updatedAtが設定されていることを確認（同一時刻の可能性があるためGreaterThanOrEqualを使用）
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.updatedAt.getTime()
      )
    })

    it("should update keyPoints", async () => {
      const created = await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: null,
        userMemo: null,
        keyPoints: ["Original"],
        stumbledPoints: [],
      })

      const updated = await repository.update(created.id, {
        keyPoints: ["New Point 1", "New Point 2"],
      })

      expect(updated).not.toBeNull()
      expect(updated?.keyPoints).toEqual(["New Point 1", "New Point 2"])
    })

    it("should update stumbledPoints", async () => {
      const created = await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: null,
        userMemo: null,
        keyPoints: [],
        stumbledPoints: ["Original stumble"],
      })

      const updated = await repository.update(created.id, {
        stumbledPoints: ["New stumble"],
      })

      expect(updated).not.toBeNull()
      expect(updated?.stumbledPoints).toEqual(["New stumble"])
    })

    it("should update multiple fields at once", async () => {
      const created = await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: null,
        userMemo: "Old memo",
        keyPoints: ["Old key"],
        stumbledPoints: ["Old stumble"],
      })

      const updated = await repository.update(created.id, {
        userMemo: "New memo",
        keyPoints: ["New key"],
        stumbledPoints: ["New stumble"],
      })

      expect(updated).not.toBeNull()
      expect(updated?.userMemo).toBe("New memo")
      expect(updated?.keyPoints).toEqual(["New key"])
      expect(updated?.stumbledPoints).toEqual(["New stumble"])
    })

    it("should return null when note does not exist", async () => {
      const updated = await repository.update("non-existent-id", {
        userMemo: "Test",
      })

      expect(updated).toBeNull()
    })

    it("should preserve unchanged fields", async () => {
      const created = await repository.create({
        userId: testData.userId,
        topicId: testData.topicId,
        sessionId: null,
        aiSummary: "Keep this",
        userMemo: "Original",
        keyPoints: ["Keep these"],
        stumbledPoints: ["Keep this too"],
      })

      const updated = await repository.update(created.id, {
        userMemo: "Updated only this",
      })

      expect(updated).not.toBeNull()
      expect(updated?.aiSummary).toBe("Keep this")
      expect(updated?.keyPoints).toEqual(["Keep these"])
      expect(updated?.stumbledPoints).toEqual(["Keep this too"])
    })
  })
})
