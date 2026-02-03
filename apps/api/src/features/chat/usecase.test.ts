/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createTestDatabase, seedTestData, type TestDatabase } from "../../test/mocks/db"
import { createChatRepository, type ChatRepository } from "./repository"
import { createLearningRepository, type LearningRepository } from "../learning/repository"
import { createMockAIAdapter } from "../../test/mocks/ai"
import type { AIAdapter, StreamChunk } from "../../shared/lib/ai"
import { defaultAIConfig } from "../../shared/lib/ai"
import {
  createSession,
  listSessionsByTopic,
  getSession,
  listMessages,
  sendMessage,
  sendMessageWithNewSession,
  evaluateQuestion,
} from "./usecase"

describe("Chat UseCase", () => {
  let db: TestDatabase
  let chatRepo: ChatRepository
  let learningRepo: LearningRepository
  let testData: ReturnType<typeof seedTestData>

  beforeEach(() => {
    const testDb = createTestDatabase()
    db = testDb.db
    testData = seedTestData(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatRepo = createChatRepository(db as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    learningRepo = createLearningRepository(db as any)
  })

  describe("createSession", () => {
    it("should create a new chat session", async () => {
      const result = await createSession(
        { chatRepo, learningRepo },
        testData.userId,
        testData.topicId
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.id).toBeDefined()
      expect(result.value.userId).toBe(testData.userId)
      expect(result.value.topicId).toBe(testData.topicId)
      expect(result.value.createdAt).toBeDefined()
      expect(result.value.updatedAt).toBeDefined()
    })

    it("should reject session creation for non-existent topic", async () => {
      const result = await createSession(
        { chatRepo, learningRepo },
        testData.userId,
        "non-existent-topic-id"
      )

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("listSessionsByTopic", () => {
    it("should list sessions with message count filter", async () => {
      // Create sessions
      const session1 = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })
      const session2 = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })
      const session3 = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      // Add messages only to session1 and session3
      await chatRepo.createMessage({
        sessionId: session1.id,
        role: "user",
        content: "Hello",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })
      await chatRepo.createMessage({
        sessionId: session1.id,
        role: "assistant",
        content: "Hi there!",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })
      await chatRepo.createMessage({
        sessionId: session3.id,
        role: "user",
        content: "Question",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      const sessions = await listSessionsByTopic(
        { chatRepo },
        testData.userId,
        testData.topicId
      )

      // session2 has no messages, should be filtered out
      expect(sessions).toHaveLength(2)
      expect(sessions.find((s) => s.id === session1.id)).toBeDefined()
      expect(sessions.find((s) => s.id === session3.id)).toBeDefined()
      expect(sessions.find((s) => s.id === session2.id)).toBeUndefined()

      // Verify message counts
      const s1 = sessions.find((s) => s.id === session1.id)
      const s3 = sessions.find((s) => s.id === session3.id)
      expect(s1?.messageCount).toBe(2)
      expect(s3?.messageCount).toBe(1)
    })

    it("should return empty array when no sessions with messages", async () => {
      // Create session without messages
      await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const sessions = await listSessionsByTopic(
        { chatRepo },
        testData.userId,
        testData.topicId
      )

      expect(sessions).toHaveLength(0)
    })
  })

  describe("getSession", () => {
    it("should return session for owner", async () => {
      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const result = await getSession({ chatRepo }, testData.userId, session.id)

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.id).toBe(session.id)
      expect(result.value.userId).toBe(testData.userId)
    })

    it("should reject access from other user", async () => {
      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const result = await getSession({ chatRepo }, "other-user-id", session.id)

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("FORBIDDEN")
    })

    it("should return 404 for non-existent session", async () => {
      const result = await getSession(
        { chatRepo },
        testData.userId,
        "non-existent-session"
      )

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("listMessages", () => {
    it("should list messages for session owner", async () => {
      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      await chatRepo.createMessage({
        sessionId: session.id,
        role: "user",
        content: "First message",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })
      await chatRepo.createMessage({
        sessionId: session.id,
        role: "assistant",
        content: "Response",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      const result = await listMessages(
        { chatRepo },
        testData.userId,
        session.id
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value).toHaveLength(2)
      expect(result.value[0].content).toBe("First message")
      expect(result.value[0].role).toBe("user")
      expect(result.value[1].content).toBe("Response")
      expect(result.value[1].role).toBe("assistant")
    })

    it("should reject access from other user", async () => {
      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const result = await listMessages(
        { chatRepo },
        "other-user-id",
        session.id
      )

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("FORBIDDEN")
    })

    it("should return 404 for non-existent session", async () => {
      const result = await listMessages(
        { chatRepo },
        testData.userId,
        "non-existent-session"
      )

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("sendMessage", () => {
    let aiAdapter: AIAdapter

    beforeEach(() => {
      aiAdapter = createMockAIAdapter({
        streamChunks: ["This is ", "the AI ", "response."],
      })
    })

    it("should save user message and stream AI response", async () => {
      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const chunks: StreamChunk[] = []
      for await (const chunk of sendMessage(
        { chatRepo, learningRepo, aiAdapter, aiConfig: defaultAIConfig },
        {
          sessionId: session.id,
          userId: testData.userId,
          content: "What is the accounting treatment?",
        }
      )) {
        chunks.push(chunk)
      }

      // Verify streaming chunks
      const textChunks = chunks.filter((c) => c.type === "text")
      expect(textChunks).toHaveLength(3)
      expect(textChunks.map((c) => c.content).join("")).toBe(
        "This is the AI response."
      )

      // Verify done chunk with messageId
      const doneChunk = chunks.find((c) => c.type === "done")
      expect(doneChunk).toBeDefined()
      expect(doneChunk?.messageId).toBeDefined()

      // Verify messages were saved
      const messages = await chatRepo.findMessagesBySession(session.id)
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("user")
      expect(messages[0].content).toBe("What is the accounting treatment?")
      expect(messages[1].role).toBe("assistant")
      expect(messages[1].content).toBe("This is the AI response.")
    })

    it("should handle AI streaming error", async () => {
      const errorAdapter = createMockAIAdapter({
        shouldError: true,
        errorMessage: "AI service unavailable",
      })

      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const chunks: StreamChunk[] = []
      for await (const chunk of sendMessage(
        { chatRepo, learningRepo, aiAdapter: errorAdapter, aiConfig: defaultAIConfig },
        {
          sessionId: session.id,
          userId: testData.userId,
          content: "Test question",
        }
      )) {
        chunks.push(chunk)
      }

      // Verify error chunk
      const errorChunk = chunks.find((c) => c.type === "error")
      expect(errorChunk).toBeDefined()
      // usecase catches the error and returns a user-friendly message in Japanese
      expect(errorChunk?.error).toBe("AI応答中にエラーが発生しました。再度お試しください。")
    })

    it("should reject access from other user", async () => {
      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const chunks: StreamChunk[] = []
      for await (const chunk of sendMessage(
        { chatRepo, learningRepo, aiAdapter, aiConfig: defaultAIConfig },
        {
          sessionId: session.id,
          userId: "other-user-id",
          content: "Unauthorized message",
        }
      )) {
        chunks.push(chunk)
      }

      expect(chunks).toHaveLength(1)
      expect(chunks[0].type).toBe("error")
      expect(chunks[0].error).toBe("Unauthorized")
    })

    it("should update topic progress after sending message", async () => {
      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const chunks: StreamChunk[] = []
      for await (const chunk of sendMessage(
        { chatRepo, learningRepo, aiAdapter, aiConfig: defaultAIConfig },
        {
          sessionId: session.id,
          userId: testData.userId,
          content: "Question",
        }
      )) {
        chunks.push(chunk)
      }

      // Verify progress was updated
      const progress = await learningRepo.findProgress(
        testData.userId,
        testData.topicId
      )
      expect(progress).not.toBeNull()
      expect(progress?.questionCount).toBe(1)
    })

    it("should include OCR result in AI context when provided", async () => {
      let capturedMessages: any[] = []
      const trackingAdapter: AIAdapter = {
        generateText: async () => ({ content: "" }),
        streamText: async function* (input) {
          capturedMessages = input.messages
          yield { type: "text", content: "Response" }
          yield { type: "done" }
        },
      }

      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      for await (const _ of sendMessage(
        { chatRepo, learningRepo, aiAdapter: trackingAdapter, aiConfig: defaultAIConfig },
        {
          sessionId: session.id,
          userId: testData.userId,
          content: "What does this image say?",
          imageId: "img-123",
          ocrResult: "Extracted text from image",
        }
      )) {
        // consume iterator
      }

      // Verify OCR result was included in the message
      const userMessage = capturedMessages.find((m) => m.role === "user")
      expect(userMessage?.content).toContain("[画像から抽出されたテキスト]")
      expect(userMessage?.content).toContain("Extracted text from image")
    })
  })

  describe("sendMessageWithNewSession", () => {
    let aiAdapter: AIAdapter

    beforeEach(() => {
      aiAdapter = createMockAIAdapter({
        streamChunks: ["New ", "session ", "response."],
      })
    })

    it("should create session and send message simultaneously", async () => {
      const chunks: (StreamChunk & { sessionId?: string })[] = []
      for await (const chunk of sendMessageWithNewSession(
        { chatRepo, learningRepo, aiAdapter, aiConfig: defaultAIConfig },
        {
          topicId: testData.topicId,
          userId: testData.userId,
          content: "First question in new session",
        }
      )) {
        chunks.push(chunk)
      }

      // Verify session_created chunk comes first
      const sessionCreatedChunk = chunks.find(
        (c) => c.type === "session_created"
      )
      expect(sessionCreatedChunk).toBeDefined()
      expect(sessionCreatedChunk?.sessionId).toBeDefined()

      const sessionId = sessionCreatedChunk?.sessionId!

      // Verify text chunks
      const textChunks = chunks.filter((c) => c.type === "text")
      expect(textChunks).toHaveLength(3)

      // Verify session was created
      const session = await chatRepo.findSessionById(sessionId)
      expect(session).not.toBeNull()
      expect(session?.userId).toBe(testData.userId)
      expect(session?.topicId).toBe(testData.topicId)

      // Verify messages were saved
      const messages = await chatRepo.findMessagesBySession(sessionId)
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("user")
      expect(messages[0].content).toBe("First question in new session")
    })

    it("should reject for non-existent topic", async () => {
      const chunks: StreamChunk[] = []
      for await (const chunk of sendMessageWithNewSession(
        { chatRepo, learningRepo, aiAdapter, aiConfig: defaultAIConfig },
        {
          topicId: "non-existent-topic",
          userId: testData.userId,
          content: "Question",
        }
      )) {
        chunks.push(chunk)
      }

      expect(chunks).toHaveLength(1)
      expect(chunks[0].type).toBe("error")
      expect(chunks[0].error).toBe("Topic not found")
    })

    it("should update progress after message sent", async () => {
      for await (const _ of sendMessageWithNewSession(
        { chatRepo, learningRepo, aiAdapter, aiConfig: defaultAIConfig },
        {
          topicId: testData.topicId,
          userId: testData.userId,
          content: "Question",
        }
      )) {
        // consume
      }

      const progress = await learningRepo.findProgress(
        testData.userId,
        testData.topicId
      )
      expect(progress?.questionCount).toBe(1)
    })
  })

  describe("evaluateQuestion", () => {
    it("should evaluate question as good", async () => {
      const goodAdapter = createMockAIAdapter({
        textResponse: '{"quality": "good", "reason": "理解の深さを問う質問"}',
      })

      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const message = await chatRepo.createMessage({
        sessionId: session.id,
        role: "user",
        content: "なぜ有価証券の減損処理では時価が50%以上下落した場合に強制適用されるのですか？これは会計上の保守主義と関係がありますか？",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      const result = await evaluateQuestion(
        { chatRepo, learningRepo, aiAdapter: goodAdapter, aiConfig: defaultAIConfig },
        message.id,
        message.content
      )

      expect(result.quality).toBe("good")

      // Verify message was updated
      const updated = await chatRepo.findMessageById(message.id)
      expect(updated?.questionQuality).toBe("good")
    })

    it("should evaluate question as surface", async () => {
      const surfaceAdapter = createMockAIAdapter({
        textResponse: '{"quality": "surface", "reason": "単純な定義の質問"}',
      })

      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const message = await chatRepo.createMessage({
        sessionId: session.id,
        role: "user",
        content: "有価証券って何ですか？",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      const result = await evaluateQuestion(
        { chatRepo, learningRepo, aiAdapter: surfaceAdapter, aiConfig: defaultAIConfig },
        message.id,
        message.content
      )

      expect(result.quality).toBe("surface")

      // Verify message was updated
      const updated = await chatRepo.findMessageById(message.id)
      expect(updated?.questionQuality).toBe("surface")
    })

    it("should default to surface when AI response is ambiguous", async () => {
      const ambiguousAdapter = createMockAIAdapter({
        textResponse: "This question is somewhat mediocre.",
      })

      const session = await chatRepo.createSession({
        userId: testData.userId,
        topicId: testData.topicId,
      })

      const message = await chatRepo.createMessage({
        sessionId: session.id,
        role: "user",
        content: "Test question",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
      })

      const result = await evaluateQuestion(
        { chatRepo, learningRepo, aiAdapter: ambiguousAdapter, aiConfig: defaultAIConfig },
        message.id,
        message.content
      )

      expect(result.quality).toBe("surface")
    })
  })
})
