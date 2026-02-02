/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Hono } from "hono"
import { SignJWT } from "jose"
import { z } from "zod"
import * as schema from "@cpa-study/db/schema"
import { chatRoutes } from "./route"
import {
  createTestDatabase,
  seedTestData,
  type TestDatabase,
} from "../../test/mocks/db"
import { createMockAIAdapter } from "../../test/mocks/ai"
import type { Env, Variables } from "../../shared/types/env"
import { parseJson, errorResponseSchema } from "../../test/helpers"
import Database from "better-sqlite3"

// Response schemas for test assertions using Zod
const sessionSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const sessionResponseSchema = z.object({
  session: sessionSchema,
})

const sessionListResponseSchema = z.object({
  sessions: z.array(
    z.object({
      id: z.string(),
      topicId: z.string(),
      userId: z.string(),
      messageCount: z.number(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
  ),
})

const messageListResponseSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      sessionId: z.string(),
      role: z.string(),
      content: z.string(),
      createdAt: z.string(),
    })
  ),
})

const evaluateResponseSchema = z.object({
  quality: z.object({
    quality: z.string(),
    reason: z.string(),
  }),
})

// Test environment
const createTestEnv = (): Env => ({
  ENVIRONMENT: "local",
  AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-for-jwt-signing-min-32-chars",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  API_BASE_URL: "http://localhost:8787",
  WEB_BASE_URL: "http://localhost:5174",
  DEV_USER_ID: "test-user-1",
  OPENROUTER_API_KEY: "test-api-key",
  DB: {} as D1Database,
  R2: {} as R2Bucket,
  RATE_LIMITER: {} as DurableObjectNamespace,
})

// Dev auth headers for local environment tests
const devAuthHeaders = { "X-Dev-User-Id": "test-user-1" }

// Test helper for JWT generation
const generateTestToken = async (
  user: { id: string; email: string; name: string; avatarUrl: string | null },
  secret: string
) => {
  const secretKey = new TextEncoder().encode(secret)
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey)
}

// Parse SSE response
const parseSSEResponse = async (
  response: Response
): Promise<Array<{ type: string; content?: string; error?: string; sessionId?: string; messageId?: string }>> => {
  const text = await response.text()
  const events: Array<{ type: string; content?: string; error?: string; sessionId?: string; messageId?: string }> = []

  const lines = text.split("\n")
  for (const line of lines) {
    if (line.startsWith("data:")) {
      const data = line.slice(5).trim()
      if (data) {
        try {
          events.push(JSON.parse(data))
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return events
}

describe("Chat Routes", () => {
  let db: TestDatabase
  let sqlite: Database.Database
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let testEnv: Env
  let testData: ReturnType<typeof seedTestData>

  beforeEach(() => {
    const testDb = createTestDatabase()
    db = testDb.db
    sqlite = testDb.sqlite
    testEnv = createTestEnv()
    testData = seedTestData(db)

    // Create Hono app with chat routes
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.route("/chat", chatRoutes({ env: testEnv, db: db as any }))
  })

  afterEach(() => {
    sqlite.close()
  })

  describe("POST /chat/sessions", () => {
    it("should create a new session for valid topic", async () => {
      const res = await app.request(
        "/chat/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...devAuthHeaders },
          body: JSON.stringify({ topicId: testData.topicId }),
        },
        testEnv
      )

      expect(res.status).toBe(201)
      const body = await parseJson(res, sessionResponseSchema)
      expect(body).toHaveProperty("session")
      expect(body.session.topicId).toBe(testData.topicId)
      expect(body.session.userId).toBe(testData.userId)
    })

    it("should return 404 for non-existent topic", async () => {
      const res = await app.request(
        "/chat/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...devAuthHeaders },
          body: JSON.stringify({ topicId: "non-existent-topic" }),
        },
        testEnv
      )

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("論点が見つかりません")
    })

    it("should return 401 when unauthenticated in production mode", async () => {
      const prodEnv = { ...testEnv, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/chat", chatRoutes({ env: prodEnv, db: db as any }))

      const res = await prodApp.request(
        "/chat/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId: testData.topicId }),
        },
        prodEnv
      )

      expect(res.status).toBe(401)
    })
  })

  describe("GET /chat/topics/:topicId/sessions", () => {
    it("should return empty array when no sessions exist", async () => {
      const res = await app.request(
        `/chat/topics/${testData.topicId}/sessions`,
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, sessionListResponseSchema)
      expect(body.sessions).toEqual([])
    })

    it("should return sessions with message count > 0", async () => {
      // Create a session
      const sessionId = crypto.randomUUID()
      const now = new Date()

      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Add a message to the session
      db.insert(schema.chatMessages)
        .values({
          id: crypto.randomUUID(),
          sessionId,
          role: "user",
          content: "Test message",
          createdAt: now,
        })
        .run()

      const res = await app.request(
        `/chat/topics/${testData.topicId}/sessions`,
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, sessionListResponseSchema)
      expect(body.sessions.length).toBe(1)
      expect(body.sessions[0].id).toBe(sessionId)
      expect(body.sessions[0].messageCount).toBe(1)
    })

    it("should not return sessions without messages", async () => {
      // Create a session without messages
      const sessionId = crypto.randomUUID()
      const now = new Date()

      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request(
        `/chat/topics/${testData.topicId}/sessions`,
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, sessionListResponseSchema)
      expect(body.sessions.length).toBe(0)
    })
  })

  describe("GET /chat/sessions/:sessionId", () => {
    it("should return session details for owned session", async () => {
      // Create a session
      const sessionId = crypto.randomUUID()
      const now = new Date()

      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request(
        `/chat/sessions/${sessionId}`,
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, sessionResponseSchema)
      expect(body.session.id).toBe(sessionId)
      expect(body.session.topicId).toBe(testData.topicId)
    })

    it("should return 404 for non-existent session", async () => {
      const res = await app.request(
        "/chat/sessions/non-existent-session",
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("セッションが見つかりません")
    })

    it("should return 403 for session owned by another user", async () => {
      // Create another user
      const otherUserId = "other-user"
      const now = new Date()

      db.insert(schema.users)
        .values({
          id: otherUserId,
          email: "other@example.com",
          name: "Other User",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Create a session owned by other user
      const sessionId = crypto.randomUUID()
      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: otherUserId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request(
        `/chat/sessions/${sessionId}`,
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(403)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("このセッションへのアクセス権限がありません")
    })
  })

  describe("GET /chat/sessions/:sessionId/messages", () => {
    it("should return messages for owned session", async () => {
      // Create a session with messages
      const sessionId = crypto.randomUUID()
      const now = new Date()

      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      db.insert(schema.chatMessages)
        .values({
          id: crypto.randomUUID(),
          sessionId,
          role: "user",
          content: "Hello",
          createdAt: now,
        })
        .run()

      db.insert(schema.chatMessages)
        .values({
          id: crypto.randomUUID(),
          sessionId,
          role: "assistant",
          content: "Hi there!",
          createdAt: new Date(now.getTime() + 1000),
        })
        .run()

      const res = await app.request(
        `/chat/sessions/${sessionId}/messages`,
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, messageListResponseSchema)
      expect(body.messages.length).toBe(2)
      expect(body.messages[0].role).toBe("user")
      expect(body.messages[1].role).toBe("assistant")
    })

    it("should return 404 for non-existent session", async () => {
      const res = await app.request(
        "/chat/sessions/non-existent-session/messages",
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(404)
    })

    it("should return 403 for session owned by another user", async () => {
      // Create another user
      const otherUserId = "other-user-2"
      const now = new Date()

      db.insert(schema.users)
        .values({
          id: otherUserId,
          email: "other2@example.com",
          name: "Other User 2",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Create a session owned by other user
      const sessionId = crypto.randomUUID()
      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: otherUserId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request(
        `/chat/sessions/${sessionId}/messages`,
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(403)
    })
  })

  describe("POST /chat/sessions/:sessionId/messages/stream", () => {
    it("should stream AI response for valid session", async () => {
      // Create a session
      const sessionId = crypto.randomUUID()
      const now = new Date()

      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request(
        `/chat/sessions/${sessionId}/messages/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...devAuthHeaders },
          body: JSON.stringify({ content: "What is securities?" }),
        },
        testEnv
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/event-stream")

      const events = await parseSSEResponse(res)
      expect(events.length).toBeGreaterThan(0)

      // Check for done event
      const doneEvent = events.find((e) => e.type === "done")
      expect(doneEvent).toBeDefined()
    })

    it("should return error for non-existent session", async () => {
      const res = await app.request(
        "/chat/sessions/non-existent/messages/stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...devAuthHeaders },
          body: JSON.stringify({ content: "Test" }),
        },
        testEnv
      )

      expect(res.status).toBe(200) // SSE returns 200 but with error event
      const events = await parseSSEResponse(res)
      const errorEvent = events.find((e) => e.type === "error")
      expect(errorEvent).toBeDefined()
      expect(errorEvent?.error).toBe("Session not found")
    })

    it("should return error for session owned by another user", async () => {
      // Create another user
      const otherUserId = "other-user-3"
      const now = new Date()

      db.insert(schema.users)
        .values({
          id: otherUserId,
          email: "other3@example.com",
          name: "Other User 3",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Create a session owned by other user
      const sessionId = crypto.randomUUID()
      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: otherUserId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request(
        `/chat/sessions/${sessionId}/messages/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...devAuthHeaders },
          body: JSON.stringify({ content: "Test" }),
        },
        testEnv
      )

      expect(res.status).toBe(200)
      const events = await parseSSEResponse(res)
      const errorEvent = events.find((e) => e.type === "error")
      expect(errorEvent).toBeDefined()
      expect(errorEvent?.error).toBe("Unauthorized")
    })

    it("should validate message content", async () => {
      // Create a session
      const sessionId = crypto.randomUUID()
      const now = new Date()

      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Empty content should fail validation
      const res = await app.request(
        `/chat/sessions/${sessionId}/messages/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...devAuthHeaders },
          body: JSON.stringify({ content: "" }),
        },
        testEnv
      )

      // Zod validator returns 400 for invalid input
      expect(res.status).toBe(400)
    })
  })

  describe("POST /chat/topics/:topicId/messages/stream", () => {
    it("should create new session and stream response", async () => {
      const res = await app.request(
        `/chat/topics/${testData.topicId}/messages/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...devAuthHeaders },
          body: JSON.stringify({ content: "What is accounting?" }),
        },
        testEnv
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/event-stream")

      const events = await parseSSEResponse(res)

      // Check for session_created event
      const sessionEvent = events.find((e) => e.type === "session_created")
      expect(sessionEvent).toBeDefined()
      expect(sessionEvent?.sessionId).toBeDefined()

      // Check for done event
      const doneEvent = events.find((e) => e.type === "done")
      expect(doneEvent).toBeDefined()
    })

    it("should return error for non-existent topic", async () => {
      const res = await app.request(
        "/chat/topics/non-existent-topic/messages/stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...devAuthHeaders },
          body: JSON.stringify({ content: "Test" }),
        },
        testEnv
      )

      expect(res.status).toBe(200)
      const events = await parseSSEResponse(res)
      const errorEvent = events.find((e) => e.type === "error")
      expect(errorEvent).toBeDefined()
      expect(errorEvent?.error).toBe("Topic not found")
    })
  })

  describe("POST /chat/messages/:messageId/evaluate", () => {
    it("should evaluate a user message", async () => {
      // Create a session with a user message
      const sessionId = crypto.randomUUID()
      const messageId = crypto.randomUUID()
      const now = new Date()

      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      db.insert(schema.chatMessages)
        .values({
          id: messageId,
          sessionId,
          role: "user",
          content: "Why does the depreciation method affect cash flow?",
          createdAt: now,
        })
        .run()

      const res = await app.request(
        `/chat/messages/${messageId}/evaluate`,
        { method: "POST", headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, evaluateResponseSchema)
      expect(body).toHaveProperty("quality")
      expect(["good", "surface"]).toContain(body.quality.quality)
    })

    it("should return 404 for non-existent message", async () => {
      const res = await app.request(
        "/chat/messages/non-existent-message/evaluate",
        { method: "POST", headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("メッセージが見つかりません")
    })

    it("should return 403 for message in session owned by another user", async () => {
      // Create another user
      const otherUserId = "other-user-4"
      const now = new Date()

      db.insert(schema.users)
        .values({
          id: otherUserId,
          email: "other4@example.com",
          name: "Other User 4",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Create a session owned by other user
      const sessionId = crypto.randomUUID()
      const messageId = crypto.randomUUID()

      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: otherUserId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      db.insert(schema.chatMessages)
        .values({
          id: messageId,
          sessionId,
          role: "user",
          content: "Test question",
          createdAt: now,
        })
        .run()

      const res = await app.request(
        `/chat/messages/${messageId}/evaluate`,
        { method: "POST", headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(403)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("このメッセージへのアクセス権限がありません")
    })
  })

  describe("Authentication in production mode", () => {
    let prodEnv: Env
    let prodApp: Hono<{ Bindings: Env; Variables: Variables }>

    beforeEach(() => {
      prodEnv = { ...testEnv, ENVIRONMENT: "production" as const }
      prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/chat", chatRoutes({ env: prodEnv, db: db as any }))
    })

    it("should return 401 for GET sessions without auth", async () => {
      const res = await prodApp.request(
        `/chat/topics/${testData.topicId}/sessions`,
        {},
        prodEnv
      )

      expect(res.status).toBe(401)
    })

    it("should return 401 for GET session detail without auth", async () => {
      const res = await prodApp.request(
        "/chat/sessions/any-session",
        {},
        prodEnv
      )

      expect(res.status).toBe(401)
    })

    it("should return 401 for GET messages without auth", async () => {
      const res = await prodApp.request(
        "/chat/sessions/any-session/messages",
        {},
        prodEnv
      )

      expect(res.status).toBe(401)
    })

    it("should return 401 for POST message without auth", async () => {
      const res = await prodApp.request(
        "/chat/sessions/any-session/messages/stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Test" }),
        },
        prodEnv
      )

      expect(res.status).toBe(401)
    })

    it("should return 401 for POST evaluate without auth", async () => {
      const res = await prodApp.request(
        "/chat/messages/any-message/evaluate",
        { method: "POST" },
        prodEnv
      )

      expect(res.status).toBe(401)
    })

    it("should allow access with valid JWT", async () => {
      const token = await generateTestToken(
        {
          id: testData.userId,
          email: "test@example.com",
          name: "Test User",
          avatarUrl: null,
        },
        prodEnv.JWT_SECRET
      )

      const res = await prodApp.request(
        `/chat/topics/${testData.topicId}/sessions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        prodEnv
      )

      expect(res.status).toBe(200)
    })
  })
})
