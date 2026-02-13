/**
 * E2Eテスト用ヘルパー
 */
import { Hono } from "hono"
import { cors } from "hono/cors"
import { createAuthFeature } from "@/features/auth"
import { createSubjectFeature } from "@/features/subject"
import { createChatFeature } from "@/features/chat"
import { createNoteFeature } from "@/features/note"
import { createImageFeature } from "@/features/image"
import { createBookmarkFeature } from "@/features/bookmark"
import { createLearningFeature } from "@/features/learning"
import { createTestDatabase, seedTestData, type TestDatabase } from "../mocks/db"
import { createMockR2Bucket } from "../mocks/r2"
import type { Env, Variables } from "@/shared/types/env"
import { loggerMiddleware } from "@/shared/middleware/logger"
import type Database from "better-sqlite3"

export type TestContext = {
  app: Hono<{ Bindings: Env; Variables: Variables }>
  db: TestDatabase
  sqlite: Database.Database
  r2: R2Bucket
  testData: ReturnType<typeof seedTestData>
  env: Env
}

/**
 * テスト環境のセットアップ
 */
export const setupTestEnv = (): TestContext => {
  const { db, sqlite } = createTestDatabase()
  const r2 = createMockR2Bucket()

  const testData = seedTestData(db)

  const env: Env = {
    ENVIRONMENT: "local",
    AI_PROVIDER: "mock",
    JWT_SECRET: "test-jwt-secret-for-e2e-testing-minimum-32-chars",
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    API_BASE_URL: "http://localhost:8787",
    WEB_BASE_URL: "http://localhost:5174",
    DEV_USER_ID: testData.userId,
    DB: {} as D1Database, // Mock: not used with better-sqlite3
    R2: r2,
    RATE_LIMITER: {} as DurableObjectNamespace,
  }

  // Create app with all features
  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    .use("*", loggerMiddleware())
    .use("*", cors())
    .route("/api/auth", createAuthFeature(env, db as unknown as Parameters<typeof createAuthFeature>[1]))
    .route("/api/subjects", createSubjectFeature(env, db as unknown as Parameters<typeof createSubjectFeature>[1]))
    .route("/api/chat", createChatFeature(env, db as unknown as Parameters<typeof createChatFeature>[1]))
    .route("/api/notes", createNoteFeature(env, db as unknown as Parameters<typeof createNoteFeature>[1]))
    .route("/api/images", createImageFeature(env, db as unknown as Parameters<typeof createImageFeature>[1]))
    .route("/api/bookmarks", createBookmarkFeature(env, db as unknown as Parameters<typeof createBookmarkFeature>[1]))
    .route("/api/learning", createLearningFeature(env, db as unknown as Parameters<typeof createLearningFeature>[1]))
    .get("/api/health", (c) => c.json({ status: "ok" }))

  return { app, db, sqlite, r2, testData, env }
}

/**
 * テスト用リクエストヘルパー
 */
export const createTestRequest = (
  app: TestContext["app"],
  env: TestContext["env"]
) => {
  const baseHeaders = {
    "Content-Type": "application/json",
    "X-Dev-User-Id": env.DEV_USER_ID || "test-user-1",
  }

  return {
    get: (path: string, headers?: Record<string, string>) =>
      app.request(path, {
        method: "GET",
        headers: { ...baseHeaders, ...headers },
      }, env),

    post: (path: string, body?: unknown, headers?: Record<string, string>) =>
      app.request(path, {
        method: "POST",
        headers: { ...baseHeaders, ...headers },
        body: body ? JSON.stringify(body) : undefined,
      }, env),

    put: (path: string, body?: unknown, headers?: Record<string, string>) =>
      app.request(path, {
        method: "PUT",
        headers: { ...baseHeaders, ...headers },
        body: body ? JSON.stringify(body) : undefined,
      }, env),

    postRaw: (path: string, body: ArrayBuffer, headers?: Record<string, string>) =>
      app.request(path, {
        method: "POST",
        headers: {
          ...baseHeaders,
          "Content-Type": "application/octet-stream",
          ...headers,
        },
        body,
      }, env),
  }
}

/**
 * SSEレスポンスをパースしてチャンクを配列で返す
 */
export const parseSSEResponse = async (response: Response): Promise<Array<{
  type: string
  content?: string
  error?: string
  messageId?: string
  sessionId?: string
}>> => {
  const text = await response.text()
  const lines = text.split("\n")
  const chunks: Array<{
    type: string
    content?: string
    error?: string
    messageId?: string
    sessionId?: string
  }> = []

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        const data = JSON.parse(line.slice(6))
        chunks.push(data)
      } catch {
        // Skip invalid JSON
      }
    }
  }

  return chunks
}

/**
 * テストデータのクリーンアップ
 */
export const cleanupTestEnv = (ctx: TestContext) => {
  ctx.sqlite.close()
}

