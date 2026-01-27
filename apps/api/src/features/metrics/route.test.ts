/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Hono } from "hono"
import { SignJWT } from "jose"
import { z } from "zod"
import * as schema from "@cpa-study/db/schema"
import { metricsRoutes } from "./route"
import {
  createTestDatabase,
  seedTestData,
  type TestDatabase,
} from "../../test/mocks/db"
import type { Env, Variables } from "../../shared/types/env"
import Database from "better-sqlite3"

// Zod schemas for response validation
const errorResponseSchema = z.object({
  error: z.string(),
})

const metricSnapshotSchema = z.object({
  id: z.string(),
  date: z.string(),
  userId: z.string(),
  checkedTopicCount: z.number(),
  sessionCount: z.number(),
  messageCount: z.number(),
  goodQuestionCount: z.number(),
  createdAt: z.string(),
})

const metricSnapshotResponseSchema = z.object({
  snapshot: metricSnapshotSchema,
})

// Daily metrics from on-the-fly aggregation (different from snapshots)
const dailyMetricSchema = z.object({
  date: z.string(),
  checkedTopicCount: z.number(),
  sessionCount: z.number(),
  messageCount: z.number(),
  goodQuestionCount: z.number(),
})

const metricsListResponseSchema = z.object({
  metrics: z.array(dailyMetricSchema),
})

const todayMetricsResponseSchema = z.object({
  metrics: z.object({
    sessionCount: z.number(),
    messageCount: z.number(),
    checkedTopicCount: z.number(),
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

describe("Metrics Routes", () => {
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

    // Create Hono app with metrics routes
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.route("/metrics", metricsRoutes({ env: testEnv, db: db as any }))
  })

  afterEach(() => {
    sqlite.close()
  })

  describe("GET /metrics/today", () => {
    it("should return today's metrics", async () => {
      const res = await app.request("/metrics/today", { headers: devAuthHeaders }, testEnv)

      expect(res.status).toBe(200)
      const body = todayMetricsResponseSchema.parse(await res.json())
      expect(body.metrics).toBeDefined()
      expect(typeof body.metrics.sessionCount).toBe("number")
      expect(typeof body.metrics.messageCount).toBe("number")
      expect(typeof body.metrics.checkedTopicCount).toBe("number")
    })

    it("should return correct counts for today's activity", async () => {
      const now = new Date()
      const sessionId = crypto.randomUUID()

      // Create session today
      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Create messages today
      db.insert(schema.chatMessages)
        .values({
          id: crypto.randomUUID(),
          sessionId,
          role: "user",
          content: "Test message 1",
          createdAt: now,
        })
        .run()

      db.insert(schema.chatMessages)
        .values({
          id: crypto.randomUUID(),
          sessionId,
          role: "user",
          content: "Test message 2",
          createdAt: now,
        })
        .run()

      // Create check history today
      db.insert(schema.topicCheckHistory)
        .values({
          id: crypto.randomUUID(),
          userId: testData.userId,
          topicId: testData.topicId,
          action: "checked",
          checkedAt: now,
        })
        .run()

      const res = await app.request("/metrics/today", { headers: devAuthHeaders }, testEnv)

      expect(res.status).toBe(200)
      const body = todayMetricsResponseSchema.parse(await res.json())
      expect(body.metrics.sessionCount).toBe(1)
      expect(body.metrics.messageCount).toBe(2)
      expect(body.metrics.checkedTopicCount).toBe(1)
    })

    it("should return 401 when unauthenticated in production mode", async () => {
      const prodEnv = { ...testEnv, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/metrics", metricsRoutes({ env: prodEnv, db: db as any }))

      const res = await prodApp.request("/metrics/today", {}, prodEnv)

      expect(res.status).toBe(401)
    })
  })

  describe("GET /metrics/daily", () => {
    it("should return all dates in range with zero counts when no data exists", async () => {
      const res = await app.request(
        "/metrics/daily?from=2024-01-01&to=2024-01-03",
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = metricsListResponseSchema.parse(await res.json())
      // On-the-fly aggregation returns all dates in range
      expect(body.metrics.length).toBe(3)
      expect(body.metrics[0].date).toBe("2024-01-01")
      expect(body.metrics[0].sessionCount).toBe(0)
      expect(body.metrics[0].messageCount).toBe(0)
    })

    it("should return aggregated metrics for the specified date range", async () => {
      // Insert test data that will be aggregated
      // Use current date (within time range that aggregation will look at)
      const now = new Date()
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const sessionId1 = crypto.randomUUID()

      // Sessions
      db.insert(schema.chatSessions)
        .values({
          id: sessionId1,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Messages
      db.insert(schema.chatMessages)
        .values({
          id: crypto.randomUUID(),
          sessionId: sessionId1,
          role: "user",
          content: "Test question 1",
          questionQuality: "good",
          createdAt: now,
        })
        .run()

      // Query for a wide date range that includes today
      const todayStr = now.toISOString().split("T")[0]
      const tomorrowStr = tomorrow.toISOString().split("T")[0]

      const res = await app.request(
        `/metrics/daily?from=${todayStr}&to=${tomorrowStr}`,
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = metricsListResponseSchema.parse(await res.json())
      expect(body.metrics.length).toBe(2)

      // Find today's metric (may be at different index due to timezone)
      const todayMetric = body.metrics.find((m) => m.sessionCount > 0)
      expect(todayMetric).toBeDefined()
      expect(todayMetric?.sessionCount).toBe(1)
      expect(todayMetric?.messageCount).toBe(1)
      expect(todayMetric?.goodQuestionCount).toBe(1)
    })

    it("should return 400 for invalid date format", async () => {
      const res = await app.request(
        "/metrics/daily?from=invalid&to=2024-01-31",
        { headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(400)
    })

    it("should return 401 when unauthenticated in production mode", async () => {
      const prodEnv = { ...testEnv, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/metrics", metricsRoutes({ env: prodEnv, db: db as any }))

      const res = await prodApp.request(
        "/metrics/daily?from=2024-01-01&to=2024-01-31",
        {},
        prodEnv
      )

      expect(res.status).toBe(401)
    })
  })

  describe("POST /metrics/snapshot", () => {
    it("should create a snapshot for today", async () => {
      const res = await app.request(
        "/metrics/snapshot",
        { method: "POST", headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(201)
      const body = metricSnapshotResponseSchema.parse(await res.json())
      expect(body.snapshot).toBeDefined()
      expect(body.snapshot.userId).toBe(testData.userId)
      // 今日の日付がセットされているか（形式チェック）
      expect(body.snapshot.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it("should aggregate metrics correctly", async () => {
      // Create some test data
      // getTodayDateString()はローカル日付を返し、aggregateForDate()はそれをUTC日付境界として解釈する
      // ローカル日付のUTC正午にデータを作成して、UTC日付範囲内に収まるようにする
      const today = new Date()
      const todayNoonUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0))
      const sessionId = crypto.randomUUID()

      // チェック済み論点（topicCheckHistoryを使用）
      db.insert(schema.topicCheckHistory)
        .values({
          id: crypto.randomUUID(),
          userId: testData.userId,
          topicId: testData.topicId,
          action: "checked",
          checkedAt: todayNoonUTC,
        })
        .run()

      // セッションとメッセージ
      db.insert(schema.chatSessions)
        .values({
          id: sessionId,
          userId: testData.userId,
          topicId: testData.topicId,
          createdAt: todayNoonUTC,
          updatedAt: todayNoonUTC,
        })
        .run()

      db.insert(schema.chatMessages)
        .values({
          id: crypto.randomUUID(),
          sessionId,
          role: "user",
          content: "Test question",
          questionQuality: "good",
          createdAt: todayNoonUTC,
        })
        .run()

      db.insert(schema.chatMessages)
        .values({
          id: crypto.randomUUID(),
          sessionId,
          role: "user",
          content: "Another question",
          questionQuality: "surface",
          createdAt: todayNoonUTC,
        })
        .run()

      const res = await app.request(
        "/metrics/snapshot",
        { method: "POST", headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(201)
      const body = metricSnapshotResponseSchema.parse(await res.json())
      expect(body.snapshot.checkedTopicCount).toBe(1)
      expect(body.snapshot.sessionCount).toBe(1)
      expect(body.snapshot.messageCount).toBe(2)
      expect(body.snapshot.goodQuestionCount).toBe(1)
    })

    it("should update existing snapshot on re-run", async () => {
      // First snapshot
      const res1 = await app.request(
        "/metrics/snapshot",
        { method: "POST", headers: devAuthHeaders },
        testEnv
      )
      expect(res1.status).toBe(201)
      const body1 = metricSnapshotResponseSchema.parse(await res1.json())

      // Add some data（topicCheckHistoryを使用）
      const now = new Date()
      db.insert(schema.topicCheckHistory)
        .values({
          id: crypto.randomUUID(),
          userId: testData.userId,
          topicId: testData.topicId,
          action: "checked",
          checkedAt: now,
        })
        .run()

      // Second snapshot (should update)
      const res2 = await app.request(
        "/metrics/snapshot",
        { method: "POST", headers: devAuthHeaders },
        testEnv
      )
      expect(res2.status).toBe(201)
      const body2 = metricSnapshotResponseSchema.parse(await res2.json())

      // Should have updated the existing snapshot
      expect(body2.snapshot.id).toBe(body1.snapshot.id)
      expect(body2.snapshot.checkedTopicCount).toBe(1)
    })
  })

  describe("POST /metrics/snapshot/:date", () => {
    it("should create a snapshot for specified date", async () => {
      const res = await app.request(
        "/metrics/snapshot/2024-01-15",
        { method: "POST", headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(201)
      const body = metricSnapshotResponseSchema.parse(await res.json())
      expect(body.snapshot.date).toBe("2024-01-15")
    })

    it("should return 400 for invalid date format", async () => {
      const res = await app.request(
        "/metrics/snapshot/invalid-date",
        { method: "POST", headers: devAuthHeaders },
        testEnv
      )

      expect(res.status).toBe(400)
    })
  })

  describe("Authentication in production mode", () => {
    let prodEnv: Env
    let prodApp: Hono<{ Bindings: Env; Variables: Variables }>

    beforeEach(() => {
      prodEnv = { ...testEnv, ENVIRONMENT: "production" as const }
      prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/metrics", metricsRoutes({ env: prodEnv, db: db as any }))
    })

    it("should return 401 for GET daily without auth", async () => {
      const res = await prodApp.request(
        "/metrics/daily?from=2024-01-01&to=2024-01-31",
        {},
        prodEnv
      )

      expect(res.status).toBe(401)
    })

    it("should return 401 for POST snapshot without auth", async () => {
      const res = await prodApp.request(
        "/metrics/snapshot",
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
        "/metrics/daily?from=2024-01-01&to=2024-01-31",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        prodEnv
      )

      expect(res.status).toBe(200)
    })
  })
})
