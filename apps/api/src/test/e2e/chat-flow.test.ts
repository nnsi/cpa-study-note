/// <reference types="@cloudflare/workers-types" />
/**
 * E2E: チャットフロー
 *
 * テスト対象:
 * - セッション作成 -> メッセージ送信 -> AI応答受信
 * - 連続メッセージ送信 -> 会話履歴確認
 * - 質問評価 -> 品質ラベル付与
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { z } from "zod"
import {
  setupTestEnv,
  createTestRequest,
  parseSSEResponse,
  cleanupTestEnv,
  type TestContext,
} from "./helpers"

// Zod schemas for response validation
const chatSessionSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  userId: z.string(),
})

const createSessionResponseSchema = z.object({
  session: chatSessionSchema,
})

const getSessionResponseSchema = z.object({
  session: chatSessionSchema,
})

const listSessionsResponseSchema = z.object({
  sessions: z.array(z.object({ id: z.string() })),
})

const chatMessageSchema = z.object({
  id: z.string(),
  role: z.string(),
})

const messagesResponseSchema = z.object({
  messages: z.array(chatMessageSchema),
})

const evaluateResponseSchema = z.object({
  quality: z.object({
    quality: z.string(),
    reason: z.string(),
  }),
})

describe("E2E: Chat Flow", () => {
  let ctx: TestContext
  let req: ReturnType<typeof createTestRequest>

  beforeAll(() => {
    ctx = setupTestEnv()
    req = createTestRequest(ctx.app, ctx.env)
  })

  afterAll(() => {
    cleanupTestEnv(ctx)
  })

  describe("Session Management", () => {
    let sessionId: string

    it("should create a new chat session", async () => {
      const res = await req.post("/api/chat/sessions", {
        topicId: ctx.testData.topicId,
      })

      expect(res.status).toBe(201)
      const data = createSessionResponseSchema.parse(await res.json())
      expect(data.session).toBeDefined()
      expect(data.session.id).toBeDefined()
      expect(data.session.topicId).toBe(ctx.testData.topicId)
      expect(data.session.userId).toBe(ctx.testData.userId)

      sessionId = data.session.id
    })

    it("should fail to create session for non-existent topic", async () => {
      const res = await req.post("/api/chat/sessions", {
        topicId: "non-existent-topic",
      })

      expect(res.status).toBe(404)
    })

    it("should get session by ID", async () => {
      expect(sessionId).toBeDefined()

      const res = await req.get(`/api/chat/sessions/${sessionId}`)

      expect(res.status).toBe(200)
      const data = getSessionResponseSchema.parse(await res.json())
      expect(data.session).toBeDefined()
      expect(data.session.id).toBe(sessionId)
    })

    it("should list sessions by topic (only sessions with messages)", async () => {
      // Note: listSessionsByTopic filters out sessions with 0 messages
      // The session created above has no messages yet, so it won't be listed
      const res = await req.get(`/api/chat/topics/${ctx.testData.topicId}/sessions`)

      expect(res.status).toBe(200)
      const data = listSessionsResponseSchema.parse(await res.json())
      expect(data.sessions).toBeDefined()
      expect(Array.isArray(data.sessions)).toBe(true)
      // Sessions with no messages are filtered out
    })
  })

  describe("Message Streaming", () => {
    let sessionId: string

    beforeAll(async () => {
      // Create a session for messaging tests
      const res = await req.post("/api/chat/sessions", {
        topicId: ctx.testData.topicId,
      })
      const data = createSessionResponseSchema.parse(await res.json())
      sessionId = data.session.id
    })

    it("should send message and receive streaming response", async () => {
      expect(sessionId).toBeDefined()

      const res = await req.post(`/api/chat/sessions/${sessionId}/messages/stream`, {
        content: "有価証券の評価方法について教えてください",
      })

      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toContain("text/event-stream")

      const chunks = await parseSSEResponse(res)
      expect(chunks.length).toBeGreaterThan(0)

      // Check for text chunks
      const textChunks = chunks.filter((c) => c.type === "text")
      expect(textChunks.length).toBeGreaterThan(0)

      // Check for done chunk
      const doneChunk = chunks.find((c) => c.type === "done")
      expect(doneChunk).toBeDefined()
    })

    it("should get messages after sending", async () => {
      const res = await req.get(`/api/chat/sessions/${sessionId}/messages`)

      expect(res.status).toBe(200)
      const data = messagesResponseSchema.parse(await res.json())
      expect(data.messages).toBeDefined()
      expect(data.messages.length).toBeGreaterThanOrEqual(2) // User message + AI response
    })

    it("should send multiple messages and maintain history", async () => {
      // Send another message
      const res = await req.post(`/api/chat/sessions/${sessionId}/messages/stream`, {
        content: "売買目的有価証券と満期保有目的有価証券の違いは？",
      })

      expect(res.status).toBe(200)
      await parseSSEResponse(res)

      // Get all messages
      const messagesRes = await req.get(`/api/chat/sessions/${sessionId}/messages`)
      const data = messagesResponseSchema.parse(await messagesRes.json())

      // Should have at least 4 messages (2 user + 2 AI)
      expect(data.messages.length).toBeGreaterThanOrEqual(4)

      // Check message order
      const userMessages = data.messages.filter((m) => m.role === "user")
      const assistantMessages = data.messages.filter((m) => m.role === "assistant")

      expect(userMessages.length).toBeGreaterThanOrEqual(2)
      expect(assistantMessages.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("New Session with First Message", () => {
    it("should create session and send message in one request", { timeout: 15000 }, async () => {
      const res = await req.post(`/api/chat/topics/${ctx.testData.topicId}/messages/stream`, {
        content: "リース会計について教えてください",
      })

      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toContain("text/event-stream")

      const chunks = await parseSSEResponse(res)

      // Check for session_created chunk
      const sessionCreatedChunk = chunks.find((c) => c.type === "session_created")
      expect(sessionCreatedChunk).toBeDefined()
      expect(sessionCreatedChunk?.sessionId).toBeDefined()

      // Check for text chunks
      const textChunks = chunks.filter((c) => c.type === "text")
      expect(textChunks.length).toBeGreaterThan(0)

      // Check for done chunk
      const doneChunk = chunks.find((c) => c.type === "done")
      expect(doneChunk).toBeDefined()

      // Verify session was created
      const sessionId = sessionCreatedChunk?.sessionId
      const sessionRes = await req.get(`/api/chat/sessions/${sessionId}`)
      expect(sessionRes.status).toBe(200)
    })

    it("should fail for non-existent topic", async () => {
      const res = await req.post("/api/chat/topics/non-existent/messages/stream", {
        content: "テストメッセージ",
      })

      expect(res.status).toBe(200) // SSE always returns 200

      const chunks = await parseSSEResponse(res)
      const errorChunk = chunks.find((c) => c.type === "error")
      expect(errorChunk).toBeDefined()
    })
  })

  describe("Question Evaluation", () => {
    let sessionId: string
    let messageId: string

    beforeAll(async () => {
      // Create session and send a message
      const res = await req.post(`/api/chat/topics/${ctx.testData.topicId}/messages/stream`, {
        content: "収益認識の5ステップモデルについて、具体的な適用事例を教えてください",
      })

      const chunks = await parseSSEResponse(res)
      const sessionChunk = chunks.find((c) => c.type === "session_created")
      sessionId = sessionChunk?.sessionId || ""

      // Get messages to find the user message ID
      const messagesRes = await req.get(`/api/chat/sessions/${sessionId}/messages`)
      const data = messagesResponseSchema.parse(await messagesRes.json())
      const userMessage = data.messages.find((m: { id: string; role: string }) => m.role === "user")
      messageId = userMessage?.id ?? ""
    })

    it("should evaluate question quality", async () => {
      expect(messageId).toBeDefined()

      const res = await req.post(`/api/chat/messages/${messageId}/evaluate`)

      expect(res.status).toBe(200)
      const data = evaluateResponseSchema.parse(await res.json())
      expect(data.quality).toBeDefined()
      expect(["good", "surface", "unclear"]).toContain(data.quality.quality)
    })

    it("should fail to evaluate non-existent message", async () => {
      const res = await req.post("/api/chat/messages/non-existent-id/evaluate")

      expect(res.status).toBe(404)
    })
  })

  describe("Complete Chat Flow", () => {
    it("should complete a full chat session flow", { timeout: 30000 }, async () => {
      // Step 1: Create new session with first message
      const firstMessageRes = await req.post(
        `/api/chat/topics/${ctx.testData.topicId}/messages/stream`,
        { content: "有価証券の基本的な分類について教えてください" }
      )
      expect(firstMessageRes.status).toBe(200)

      const firstChunks = await parseSSEResponse(firstMessageRes)
      const sessionChunk = firstChunks.find((c) => c.type === "session_created")
      expect(sessionChunk?.sessionId).toBeDefined()
      const sessionId = sessionChunk!.sessionId!

      // Verify text response was received
      const textChunks = firstChunks.filter((c) => c.type === "text")
      expect(textChunks.length).toBeGreaterThan(0)

      // Step 2: Send follow-up message
      const followUpRes = await req.post(
        `/api/chat/sessions/${sessionId}/messages/stream`,
        { content: "売買目的有価証券の評価差額の処理はどうなりますか？" }
      )
      expect(followUpRes.status).toBe(200)

      const followUpChunks = await parseSSEResponse(followUpRes)
      expect(followUpChunks.some((c) => c.type === "text")).toBe(true)

      // Step 3: Get all messages and verify conversation history
      const messagesRes = await req.get(`/api/chat/sessions/${sessionId}/messages`)
      expect(messagesRes.status).toBe(200)
      const { messages } = messagesResponseSchema.parse(await messagesRes.json())

      // Should have 4 messages: 2 user + 2 assistant
      expect(messages.length).toBe(4)

      // Verify message order and roles
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant")
      expect(messages[2].role).toBe("user")
      expect(messages[3].role).toBe("assistant")

      // Step 4: Evaluate one of the user's questions
      const userMessage = messages.find((m: { id: string; role: string }) => m.role === "user")
      const evalRes = await req.post(`/api/chat/messages/${userMessage!.id}/evaluate`)
      expect(evalRes.status).toBe(200)

      const { quality } = evaluateResponseSchema.parse(await evalRes.json())
      expect(["good", "surface", "unclear"]).toContain(quality.quality)

      // Step 5: Verify session appears in topic sessions list
      const sessionsRes = await req.get(`/api/chat/topics/${ctx.testData.topicId}/sessions`)
      expect(sessionsRes.status).toBe(200)
      const { sessions } = listSessionsResponseSchema.parse(await sessionsRes.json())
      expect(sessions.some((s: { id: string }) => s.id === sessionId)).toBe(true)
    })
  })
})
