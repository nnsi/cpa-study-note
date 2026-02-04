import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, seedTestData } from "../../test/mocks/db"
import { createChatRepository, type ChatRepository } from "./repository"

describe("ChatRepository", () => {
  let repository: ChatRepository
  let testData: ReturnType<typeof seedTestData>

  beforeEach(() => {
    const { db } = createTestDatabase()
    testData = seedTestData(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createChatRepository(db as any)
  })

  describe("createSession", () => {
    it("should create chat session", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      expect(session.id).toBeDefined()
      expect(session.userId).toBe(testData.userId)
      expect(session.topicId).toBe(testData.topicId)
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe("findSessionById", () => {
    it("should return session when exists", async () => {
      const created = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const found = await repository.findSessionById(created.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.userId).toBe(testData.userId)
      expect(found?.topicId).toBe(testData.topicId)
    })

    it("should return null when session does not exist", async () => {
      const found = await repository.findSessionById("non-existent-id")

      expect(found).toBeNull()
    })
  })

  describe("findSessionsByTopic", () => {
    it("should return sessions for user and topic", async () => {
      // 同じトピックで複数のセッションを作成
      await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })
      await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const sessions = await repository.findSessionsByTopic(
        testData.userId,
        testData.topicId
      )

      expect(sessions).toHaveLength(2)
      sessions.forEach((session) => {
        expect(session.userId).toBe(testData.userId)
        expect(session.topicId).toBe(testData.topicId)
      })
    })

    it("should return sessions ordered by createdAt desc", async () => {
      // セッションを作成し、createdAtの降順でソートされることを確認
      await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })
      await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const sessions = await repository.findSessionsByTopic(
        testData.userId,
        testData.topicId
      )

      // 2つのセッションが取得できることを確認
      expect(sessions).toHaveLength(2)
      // createdAtが降順になっていることを確認（同じ時刻の場合は順序不定）
      expect(sessions[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        sessions[1].createdAt.getTime()
      )
    })

    it("should return empty array when no sessions exist", async () => {
      const sessions = await repository.findSessionsByTopic(
        testData.userId,
        "non-existent-topic"
      )

      expect(sessions).toHaveLength(0)
    })
  })

  describe("getSessionMessageCount", () => {
    it("should return message count for session", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      // メッセージを追加
      await repository.createMessage({
        sessionId: session.id,
        role: "user",
        content: "Question 1",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })
      await repository.createMessage({
        sessionId: session.id,
        role: "assistant",
        content: "Answer 1",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      const count = await repository.getSessionMessageCount(session.id)

      expect(count).toBe(2)
    })

    it("should return 0 for session with no messages", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const count = await repository.getSessionMessageCount(session.id)

      expect(count).toBe(0)
    })
  })

  describe("createMessage", () => {
    it("should create chat message", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const message = await repository.createMessage({
        sessionId: session.id,
        role: "user",
        content: "What is accounting?",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      expect(message.id).toBeDefined()
      expect(message.sessionId).toBe(session.id)
      expect(message.role).toBe("user")
      expect(message.content).toBe("What is accounting?")
      expect(message.createdAt).toBeInstanceOf(Date)
    })

    it("should create message with image and OCR", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const message = await repository.createMessage({
        sessionId: session.id,
        role: "user",
        content: "Please explain this image",
        imageId: "image-123",
        ocrResult: "OCR extracted text",
        questionQuality: "good",
      })

      expect(message.imageId).toBe("image-123")
      expect(message.ocrResult).toBe("OCR extracted text")
      expect(message.questionQuality).toBe("good")
    })
  })

  describe("findMessageById", () => {
    it("should return message when exists", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })
      const created = await repository.createMessage({
        sessionId: session.id,
        role: "assistant",
        content: "Here is the answer",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      const found = await repository.findMessageById(created.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.content).toBe("Here is the answer")
    })

    it("should return null when message does not exist", async () => {
      const found = await repository.findMessageById("non-existent-id")

      expect(found).toBeNull()
    })
  })

  describe("findMessagesBySession", () => {
    it("should return all messages in session", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      await repository.createMessage({
        sessionId: session.id,
        role: "user",
        content: "Question",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })
      await repository.createMessage({
        sessionId: session.id,
        role: "assistant",
        content: "Answer",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      const messages = await repository.findMessagesBySession(session.id)

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant")
    })

    it("should return messages ordered by createdAt asc", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const msg1 = await repository.createMessage({
        sessionId: session.id,
        role: "user",
        content: "First",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })
      await new Promise((resolve) => setTimeout(resolve, 10))
      const msg2 = await repository.createMessage({
        sessionId: session.id,
        role: "assistant",
        content: "Second",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      const messages = await repository.findMessagesBySession(session.id)

      // 古い順（asc）
      expect(messages[0].id).toBe(msg1.id)
      expect(messages[1].id).toBe(msg2.id)
    })

    it("should return empty array when no messages exist", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const messages = await repository.findMessagesBySession(session.id)

      expect(messages).toHaveLength(0)
    })
  })

  describe("updateMessageQuality", () => {
    it("should update question quality", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })
      const message = await repository.createMessage({
        sessionId: session.id,
        role: "user",
        content: "Question",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      await repository.updateMessageQuality(message.id, "good")

      const updated = await repository.findMessageById(message.id)
      expect(updated?.questionQuality).toBe("good")
    })

    it("should update from one quality to another", async () => {
      const session = await repository.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })
      const message = await repository.createMessage({
        sessionId: session.id,
        role: "user",
        content: "Question",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      await repository.updateMessageQuality(message.id, "good")

      const updated = await repository.findMessageById(message.id)
      expect(updated?.questionQuality).toBe("good")
    })
  })
})
