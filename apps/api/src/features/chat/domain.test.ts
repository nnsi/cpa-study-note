import { describe, it, expect } from "vitest"
import {
  chatSessionSchema,
  chatMessageSchema,
  messageRoleSchema,
  questionQualitySchema,
  createSessionRequestSchema,
  sendMessageRequestSchema,
} from "@cpa-study/shared/schemas"
import type { ChatSession, ChatMessage } from "./repository"

describe("Chat Domain Types", () => {
  describe("ChatSession type (from repository)", () => {
    it("should accept valid ChatSession object", () => {
      const session: ChatSession = {
        id: "session-123",
        userId: "user-123",
        topicId: "topic-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(session.id).toBe("session-123")
      expect(session.userId).toBe("user-123")
      expect(session.topicId).toBe("topic-123")
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe("ChatMessage type (from repository)", () => {
    it("should accept valid user message", () => {
      const message: ChatMessage = {
        id: "msg-123",
        sessionId: "session-123",
        role: "user",
        content: "What is depreciation?",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
        createdAt: new Date(),
      }

      expect(message.id).toBe("msg-123")
      expect(message.role).toBe("user")
      expect(message.content).toBe("What is depreciation?")
      expect(message.imageId).toBeNull()
    })

    it("should accept message with image", () => {
      const message: ChatMessage = {
        id: "msg-124",
        sessionId: "session-123",
        role: "user",
        content: "What does this formula mean?",
        imageId: "image-123",
        ocrResult: "OCR extracted text from image",
        questionQuality: "good",
        createdAt: new Date(),
      }

      expect(message.imageId).toBe("image-123")
      expect(message.ocrResult).toBe("OCR extracted text from image")
      expect(message.questionQuality).toBe("good")
    })

    it("should accept assistant message", () => {
      const message: ChatMessage = {
        id: "msg-125",
        sessionId: "session-123",
        role: "assistant",
        content: "Depreciation is the allocation of asset cost...",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
        createdAt: new Date(),
      }

      expect(message.role).toBe("assistant")
    })
  })

  describe("chatSessionSchema (Zod)", () => {
    it("should parse valid session data", () => {
      const data = {
        id: "session-123",
        userId: "user-123",
        topicId: "topic-123",
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = chatSessionSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe("session-123")
      }
    })

    it("should reject invalid datetime format", () => {
      const data = {
        id: "session-123",
        userId: "user-123",
        topicId: "topic-123",
        createdAt: "invalid-date",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = chatSessionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it("should reject missing required fields", () => {
      const data = {
        id: "session-123",
        userId: "user-123",
      }

      const result = chatSessionSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe("chatMessageSchema (Zod)", () => {
    it("should parse valid message data", () => {
      const data = {
        id: "msg-123",
        sessionId: "session-123",
        role: "user",
        content: "Test question",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
        createdAt: "2024-01-15T10:00:00.000Z",
      }

      const result = chatMessageSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it("should parse message with quality rating", () => {
      const data = {
        id: "msg-123",
        sessionId: "session-123",
        role: "user",
        content: "Deep question about accounting",
        imageId: null,
        ocrResult: null,
        questionQuality: "good",
        createdAt: "2024-01-15T10:00:00.000Z",
      }

      const result = chatMessageSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.questionQuality).toBe("good")
      }
    })

    it("should reject invalid role", () => {
      const data = {
        id: "msg-123",
        sessionId: "session-123",
        role: "invalid-role",
        content: "Test",
        imageId: null,
        ocrResult: null,
        questionQuality: null,
        createdAt: "2024-01-15T10:00:00.000Z",
      }

      const result = chatMessageSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe("messageRoleSchema (Zod)", () => {
    it("should accept valid roles", () => {
      expect(messageRoleSchema.parse("user")).toBe("user")
      expect(messageRoleSchema.parse("assistant")).toBe("assistant")
      expect(messageRoleSchema.parse("system")).toBe("system")
    })

    it("should reject invalid role", () => {
      const result = messageRoleSchema.safeParse("admin")
      expect(result.success).toBe(false)
    })
  })

  describe("questionQualitySchema (Zod)", () => {
    it("should accept valid quality values", () => {
      expect(questionQualitySchema.parse("good")).toBe("good")
      expect(questionQualitySchema.parse("surface")).toBe("surface")
      expect(questionQualitySchema.parse(null)).toBeNull()
    })

    it("should reject invalid quality value", () => {
      const result = questionQualitySchema.safeParse("excellent")
      expect(result.success).toBe(false)
    })
  })

  describe("createSessionRequestSchema (Zod)", () => {
    it("should parse valid request", () => {
      const result = createSessionRequestSchema.safeParse({
        topicId: "topic-123",
      })
      expect(result.success).toBe(true)
    })

    it("should reject missing topicId", () => {
      const result = createSessionRequestSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe("sendMessageRequestSchema (Zod)", () => {
    it("should parse valid request without image", () => {
      const result = sendMessageRequestSchema.safeParse({
        content: "What is the difference between FIFO and LIFO?",
      })
      expect(result.success).toBe(true)
    })

    it("should parse valid request with image", () => {
      const result = sendMessageRequestSchema.safeParse({
        content: "Explain this formula",
        imageId: "image-123",
      })
      expect(result.success).toBe(true)
    })

    it("should reject empty content", () => {
      const result = sendMessageRequestSchema.safeParse({
        content: "",
      })
      expect(result.success).toBe(false)
    })

    it("should reject content exceeding max length", () => {
      const result = sendMessageRequestSchema.safeParse({
        content: "a".repeat(10001),
      })
      expect(result.success).toBe(false)
    })
  })
})
