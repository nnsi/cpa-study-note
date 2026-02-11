/**
 * E2E テスト用 API サーバ
 * in-memory SQLite + mock AI + mock R2 で全Featureを起動
 */
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { createAuthFeature } from "@/features/auth"
import { createChatFeature } from "@/features/chat"
import { createNoteFeature } from "@/features/note"
import { createImageFeature } from "@/features/image"
import { createMetricsFeature } from "@/features/metrics"
import { createStudyDomainFeature } from "@/features/study-domain"
import { createSubjectFeature } from "@/features/subject"
import { createBookmarkFeature } from "@/features/bookmark"
import { createLearningFeature } from "@/features/learning"
import { createViewFeature } from "@/features/view"
import { createExerciseFeature } from "@/features/exercise"
import { createTopicGeneratorFeature } from "@/features/topic-generator"
import { createStudyPlanFeature } from "@/features/study-plan"
import { createTestDatabase, seedTestData } from "@/test/mocks/db"
import { createMockR2Bucket } from "@/test/mocks/r2"
import type { Env, Variables } from "@/shared/types/env"
import type { Db } from "@cpa-study/db"

const PORT = 4567

// DB & seed
const { db, sqlite } = createTestDatabase()
const testData = seedTestData(db)
const r2 = createMockR2Bucket()

const env: Env = {
  ENVIRONMENT: "local",
  AI_PROVIDER: "mock",
  JWT_SECRET: "test-jwt-secret-for-e2e-testing-minimum-32-chars",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  API_BASE_URL: `http://localhost:${PORT}`,
  WEB_BASE_URL: "http://localhost:4568",
  DEV_USER_ID: testData.userId,
  DB: {} as D1Database,
  R2: r2,
  RATE_LIMITER: {} as DurableObjectNamespace,
}

// Db型へキャスト (better-sqlite3 → D1 互換)
const typedDb = db as unknown as Db

const app = new Hono<{ Bindings: Env; Variables: Variables }>()
  .use("*", cors({ origin: "*", credentials: true }))
  .route("/api/auth", createAuthFeature(env, typedDb))
  .route("/api/chat", createChatFeature(env, typedDb))
  .route("/api/notes", createNoteFeature(env, typedDb))
  .route("/api/images", createImageFeature(env, typedDb))
  .route("/api/metrics", createMetricsFeature(env, typedDb))
  .route("/api/study-domains", createStudyDomainFeature(env, typedDb))
  .route("/api/subjects", createSubjectFeature(env, typedDb))
  .route("/api/bookmarks", createBookmarkFeature(env, typedDb))
  .route("/api/learning", createLearningFeature(env, typedDb))
  .route("/api/view", createViewFeature(env, typedDb))
  .route("/api/exercises", createExerciseFeature(env, typedDb))
  .route("/api/topic-generator", createTopicGeneratorFeature(env, typedDb))
  .route("/api/study-plans", createStudyPlanFeature(env, typedDb))
  .get("/api/health", (c) => c.json({ status: "ok" }))
  .post("/api/test/reset", (c) => {
    // テスト間の共有状態をリセット（シードデータは残す）
    sqlite.exec("DELETE FROM chat_messages")
    sqlite.exec("DELETE FROM chat_sessions")
    sqlite.exec("DELETE FROM notes")
    sqlite.exec("DELETE FROM user_bookmarks")
    sqlite.exec("DELETE FROM topic_check_history")
    console.log("[E2E Server] DB reset complete")
    return c.json({ status: "ok" })
  })
  .onError((error, c) => {
    console.error(`[E2E Server Error] ${c.req.method} ${c.req.path}:`, error)
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal Server Error" } },
      500
    )
  })

// Graceful shutdown
process.on("SIGINT", () => {
  sqlite.close()
  process.exit(0)
})
process.on("SIGTERM", () => {
  sqlite.close()
  process.exit(0)
})

console.log(`[E2E Server] Starting on port ${PORT}...`)
console.log(`[E2E Server] Seed data: userId=${testData.userId}, topicId=${testData.topicId}`)

serve({
  fetch: (req) => app.fetch(req, env),
  port: PORT,
}, () => {
  console.log(`[E2E Server] Ready at http://localhost:${PORT}`)
})
