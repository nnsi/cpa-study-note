/// <reference types="@cloudflare/workers-types" />
/**
 * Exercise Routes の統合テスト
 *
 * analyzeは multipart/form-data + AI + R2 が絡み統合テストが困難なため、
 * confirm と getTopicExercises のルートテストを行う。
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { Hono } from "hono"
import { z } from "zod"
import type { Env, Variables } from "../../shared/types/env"
import { exerciseRoutes } from "./route"
import {
  setupTestContext,
  createAuthHeaders,
  createImageTestData,
  parseJson,
  errorResponseSchema,
  type TestContext,
} from "../../test/helpers"
import { loggerMiddleware } from "../../shared/middleware/logger"
import * as schema from "@cpa-study/db/schema"

// AI Adapterをモック
vi.mock("../../shared/lib/ai", () => ({
  createAIAdapter: () => ({
    generateText: vi.fn().mockResolvedValue({ content: "mock ocr text" }),
    streamText: vi.fn(),
  }),
  resolveAIConfig: () => ({
    chat: { model: "test-model", temperature: 0.7, maxTokens: 2000 },
    evaluation: { model: "test-model", temperature: 0, maxTokens: 100 },
    noteSummary: { model: "test-model", temperature: 0.3, maxTokens: 1000 },
    ocr: { model: "openai/gpt-4o-mini", temperature: 0, maxTokens: 2000 },
    speechCorrection: { model: "test-model", temperature: 0, maxTokens: 500 },
    topicGenerator: { model: "test-model", temperature: 0.5, maxTokens: 3000 },
    planAssistant: { model: "test-model", temperature: 0.5, maxTokens: 3000 },
    quickChatSuggest: { model: "test-model", temperature: 0, maxTokens: 500 },
  }),
}))

// レスポンススキーマ
const confirmResponseSchema = z.object({
  exerciseId: z.string(),
  topicId: z.string(),
  topicChecked: z.boolean(),
  createdAt: z.string(),
})

const topicExercisesSchema = z.object({
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      imageId: z.string(),
      ocrText: z.string().nullable(),
      createdAt: z.string(),
      markedAsUnderstood: z.boolean(),
    })
  ),
})

// テスト用にexerciseを直接DBに作成するヘルパー
const createTestExercise = (
  db: any,
  userId: string,
  imageId: string,
  data: { id?: string; topicId?: string; confirmedAt?: Date } = {}
) => {
  const exerciseId = data.id || `exercise-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date()

  db.insert(schema.exercises)
    .values({
      id: exerciseId,
      userId,
      imageId,
      topicId: data.topicId || null,
      suggestedTopicIds: JSON.stringify([]),
      markedAsUnderstood: false,
      createdAt: now,
      confirmedAt: data.confirmedAt || null,
    })
    .run()

  return { exerciseId }
}

describe("Exercise Routes", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>

  beforeEach(() => {
    ctx = setupTestContext()

    const routes = exerciseRoutes({ env: ctx.env, db: ctx.db as any })

    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, ctx.env)
      await next()
    })
    app.use("*", loggerMiddleware())
    app.route("/exercises", routes)
  })

  describe("POST /exercises/:exerciseId/confirm - 論点確定", () => {
    it("問題を論点に確定できる", async () => {
      const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)
      const { exerciseId } = createTestExercise(ctx.db, ctx.testData.userId, imageId)

      const res = await app.request(`/exercises/${exerciseId}/confirm`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          topicId: ctx.testData.topicId,
          markAsUnderstood: false,
        }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, confirmResponseSchema)
      expect(body.exerciseId).toBe(exerciseId)
      expect(body.topicId).toBe(ctx.testData.topicId)
      expect(body.topicChecked).toBe(false)
    })

    it("理解済みマーク付きで確定できる", async () => {
      const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)
      const { exerciseId } = createTestExercise(ctx.db, ctx.testData.userId, imageId)

      const res = await app.request(`/exercises/${exerciseId}/confirm`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          topicId: ctx.testData.topicId,
          markAsUnderstood: true,
        }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, confirmResponseSchema)
      expect(body.topicChecked).toBe(true)
    })

    it("存在しない問題は404を返す", async () => {
      const res = await app.request("/exercises/non-existent/confirm", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          topicId: ctx.testData.topicId,
          markAsUnderstood: false,
        }),
      })

      expect(res.status).toBe(404)
    })

    it("既に確定済みの問題は400を返す", async () => {
      const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)
      const { exerciseId } = createTestExercise(ctx.db, ctx.testData.userId, imageId, {
        topicId: ctx.testData.topicId,
        confirmedAt: new Date(),
      })

      const res = await app.request(`/exercises/${exerciseId}/confirm`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          topicId: ctx.testData.topicId,
          markAsUnderstood: false,
        }),
      })

      expect(res.status).toBe(400)
    })

    it("topicIdが空の場合は400を返す", async () => {
      const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)
      const { exerciseId } = createTestExercise(ctx.db, ctx.testData.userId, imageId)

      const res = await app.request(`/exercises/${exerciseId}/confirm`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          topicId: "",
          markAsUnderstood: false,
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe("GET /exercises/topics/:topicId - 論点別問題一覧", () => {
    it("論点に紐づく問題一覧を取得できる", async () => {
      const { imageId: imageId1 } = createImageTestData(ctx.db, ctx.testData.userId)
      const { imageId: imageId2 } = createImageTestData(ctx.db, ctx.testData.userId)
      const { exerciseId: id1 } = createTestExercise(ctx.db, ctx.testData.userId, imageId1)
      const { exerciseId: id2 } = createTestExercise(ctx.db, ctx.testData.userId, imageId2)

      // exerciseをtopicに確定（confirmエンドポイント経由）
      await app.request(`/exercises/${id1}/confirm`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ topicId: ctx.testData.topicId, markAsUnderstood: false }),
      })
      await app.request(`/exercises/${id2}/confirm`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ topicId: ctx.testData.topicId, markAsUnderstood: false }),
      })

      const res = await app.request(`/exercises/topics/${ctx.testData.topicId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, topicExercisesSchema)
      expect(body.exercises).toHaveLength(2)
    })

    it("問題がない場合は空配列を返す", async () => {
      const res = await app.request(`/exercises/topics/${ctx.testData.topicId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, topicExercisesSchema)
      expect(body.exercises).toEqual([])
    })
  })

  describe("認証エラー", () => {
    it("本番環境で認証なしの場合は401を返す", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = exerciseRoutes({ env: prodEnv, db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.use("*", loggerMiddleware())
      prodApp.route("/exercises", routes)

      const res = await prodApp.request("/exercises/topics/some-topic", {
        headers: { "Content-Type": "application/json" },
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("認証が必要です")
    })
  })
})
