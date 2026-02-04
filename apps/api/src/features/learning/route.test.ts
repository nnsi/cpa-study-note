/// <reference types="@cloudflare/workers-types" />
/**
 * Learning Routes の統合テスト
 */
import { describe, it, expect, beforeEach } from "vitest"
import { Hono } from "hono"
import { z } from "zod"
import type { Env, Variables } from "../../shared/types/env"
import { learningRoutes } from "./route"
import {
  setupTestContext,
  createAuthHeaders,
  createAdditionalTestData,
  createProgressTestData,
  createTestStudyDomain,
  createTestSubject,
  createTestCategory,
  createTestTopic,
  parseJson,
  errorResponseSchema,
  type TestContext,
} from "../../test/helpers"
import * as schema from "@cpa-study/db/schema"

// レスポンススキーマ定義
const progressSchema = z.object({
  userId: z.string(),
  topicId: z.string(),
  understood: z.boolean(),
  lastAccessedAt: z.string().nullable(),
  questionCount: z.number(),
  goodQuestionCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const progressResponseSchema = z.object({
  progress: progressSchema.nullable(),
})

const checkHistoryItemSchema = z.object({
  id: z.string(),
  action: z.enum(["checked", "unchecked"]),
  checkedAt: z.string(),
})

const checkHistoryResponseSchema = z.object({
  history: z.array(checkHistoryItemSchema),
})

const recentTopicSchema = z.object({
  topicId: z.string(),
  topicName: z.string(),
  subjectId: z.string(),
  subjectName: z.string(),
  categoryId: z.string(),
  lastAccessedAt: z.string(),
})

const recentTopicsResponseSchema = z.object({
  topics: z.array(recentTopicSchema),
})

const progressListResponseSchema = z.object({
  progress: z.array(progressSchema),
})

const subjectProgressStatsSchema = z.object({
  subjectId: z.string(),
  subjectName: z.string(),
  totalTopics: z.number(),
  understoodTopics: z.number(),
})

const subjectProgressStatsResponseSchema = z.object({
  stats: z.array(subjectProgressStatsSchema),
})

describe("Learning Routes", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let additionalData: ReturnType<typeof createAdditionalTestData>

  beforeEach(() => {
    ctx = setupTestContext()
    additionalData = createAdditionalTestData(ctx.db, ctx.testData)

    // ルートを作成
    const routes = learningRoutes({ db: ctx.db as any })

    // メインアプリにマウント（環境変数を初期化）
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, ctx.env)
      await next()
    })
    app.route("/learning", routes)
  })

  describe("POST /learning/topics/:topicId/touch - トピックアクセス記録", () => {
    it("トピックにアクセスするとprogressが作成される", async () => {
      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/touch`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, z.object({ progress: progressSchema }))
      expect(body.progress.topicId).toBe(ctx.testData.topicId)
      expect(body.progress.userId).toBe(ctx.testData.userId)
      expect(body.progress.lastAccessedAt).toBeTruthy()
    })

    it("既存のprogressが更新される", async () => {
      // 最初にprogressを作成
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)

      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/touch`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, z.object({ progress: progressSchema }))
      expect(body.progress.topicId).toBe(ctx.testData.topicId)
      expect(body.progress.lastAccessedAt).toBeTruthy()
    })

    it("存在しないトピックは404を返す", async () => {
      const res = await app.request("/learning/topics/non-existent-topic/touch", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("論点が見つかりません")
    })

    it("他ユーザーのトピックにはアクセスできない", async () => {
      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/touch`, {
        method: "POST",
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("論点が見つかりません")
    })

    it("削除済みのトピックにはアクセスできない", async () => {
      // 削除済みトピックを作成
      const { id: domainId } = createTestStudyDomain(ctx.db, ctx.testData.userId)
      const { id: subjectId } = createTestSubject(ctx.db, ctx.testData.userId, domainId)
      const { id: categoryId } = createTestCategory(ctx.db, ctx.testData.userId, subjectId)
      const { id: deletedTopicId } = createTestTopic(ctx.db, ctx.testData.userId, categoryId, {
        deletedAt: new Date(),
      })

      const res = await app.request(`/learning/topics/${deletedTopicId}/touch`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
    })
  })

  describe("PUT /learning/topics/:topicId/progress - 進捗更新", () => {
    it("understoodをtrueに更新できる", async () => {
      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/progress`, {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ understood: true }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, z.object({ progress: progressSchema }))
      expect(body.progress.understood).toBe(true)
    })

    it("understoodをfalseに更新できる", async () => {
      // まずtrueに設定
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)

      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/progress`, {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ understood: false }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, z.object({ progress: progressSchema }))
      expect(body.progress.understood).toBe(false)
    })

    it("空のボディでも更新可能", async () => {
      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/progress`, {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, z.object({ progress: progressSchema }))
      expect(body.progress).toBeDefined()
    })

    it("存在しないトピックは404を返す", async () => {
      const res = await app.request("/learning/topics/non-existent-topic/progress", {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ understood: true }),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("論点が見つかりません")
    })

    it("他ユーザーのトピックは更新できない", async () => {
      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/progress`, {
        method: "PUT",
        headers: createAuthHeaders(additionalData.otherUserId),
        body: JSON.stringify({ understood: true }),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("論点が見つかりません")
    })
  })

  describe("GET /learning/topics/:topicId/progress - 進捗取得", () => {
    it("進捗を取得できる", async () => {
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)

      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/progress`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressResponseSchema)
      expect(body.progress).not.toBeNull()
      expect(body.progress?.topicId).toBe(ctx.testData.topicId)
      expect(body.progress?.understood).toBe(true)
    })

    it("進捗がない場合はnullを返す", async () => {
      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/progress`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressResponseSchema)
      expect(body.progress).toBeNull()
    })

    it("存在しないトピックは404を返す", async () => {
      const res = await app.request("/learning/topics/non-existent-topic/progress", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("論点が見つかりません")
    })

    it("他ユーザーのトピック進捗は取得できない", async () => {
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)

      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/progress`, {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("論点が見つかりません")
    })
  })

  describe("GET /learning/topics/:topicId/check-history - チェック履歴取得", () => {
    it("チェック履歴を取得できる", async () => {
      // チェック履歴を作成
      const now = new Date()
      ctx.db
        .insert(schema.topicCheckHistory)
        .values({
          id: "history-1",
          topicId: ctx.testData.topicId,
          userId: ctx.testData.userId,
          action: "checked",
          checkedAt: now,
        })
        .run()
      ctx.db
        .insert(schema.topicCheckHistory)
        .values({
          id: "history-2",
          topicId: ctx.testData.topicId,
          userId: ctx.testData.userId,
          action: "unchecked",
          checkedAt: new Date(now.getTime() + 1000),
        })
        .run()

      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/check-history`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, checkHistoryResponseSchema)
      expect(body.history).toHaveLength(2)
      expect(body.history[0].action).toBe("unchecked") // 降順なので最新が先
      expect(body.history[1].action).toBe("checked")
    })

    it("履歴がない場合は空配列を返す", async () => {
      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/check-history`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, checkHistoryResponseSchema)
      expect(body.history).toEqual([])
    })

    it("存在しないトピックは404を返す", async () => {
      const res = await app.request("/learning/topics/non-existent-topic/check-history", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("論点が見つかりません")
    })

    it("他ユーザーのトピック履歴は取得できない", async () => {
      // 自分の履歴を作成
      ctx.db
        .insert(schema.topicCheckHistory)
        .values({
          id: "history-1",
          topicId: ctx.testData.topicId,
          userId: ctx.testData.userId,
          action: "checked",
          checkedAt: new Date(),
        })
        .run()

      const res = await app.request(`/learning/topics/${ctx.testData.topicId}/check-history`, {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("論点が見つかりません")
    })
  })

  describe("GET /learning/topics/recent - 最近アクセスしたトピック", () => {
    it("最近アクセスしたトピック一覧を取得できる", async () => {
      // 進捗データを作成（lastAccessedAtが設定される）
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)
      createProgressTestData(ctx.db, ctx.testData.userId, additionalData.topic2Id)

      const res = await app.request("/learning/topics/recent", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, recentTopicsResponseSchema)
      expect(body.topics.length).toBe(2)
      body.topics.forEach((topic) => {
        expect(topic.topicId).toBeTruthy()
        expect(topic.topicName).toBeTruthy()
        expect(topic.subjectId).toBeTruthy()
        expect(topic.subjectName).toBeTruthy()
        expect(topic.lastAccessedAt).toBeTruthy()
      })
    })

    it("limitパラメータで取得数を制限できる", async () => {
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)
      createProgressTestData(ctx.db, ctx.testData.userId, additionalData.topic2Id)

      const res = await app.request("/learning/topics/recent?limit=1", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, recentTopicsResponseSchema)
      expect(body.topics.length).toBe(1)
    })

    it("データがない場合は空配列を返す", async () => {
      const res = await app.request("/learning/topics/recent", {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, recentTopicsResponseSchema)
      expect(body.topics).toEqual([])
    })

    it("他ユーザーのデータは含まれない", async () => {
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)

      const res = await app.request("/learning/topics/recent", {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, recentTopicsResponseSchema)
      expect(body.topics).toEqual([])
    })

    it("削除済みトピックは含まれない", async () => {
      // 削除済みのトピックを作成してprogressを追加
      const { id: domainId } = createTestStudyDomain(ctx.db, ctx.testData.userId)
      const { id: subjectId } = createTestSubject(ctx.db, ctx.testData.userId, domainId)
      const { id: categoryId } = createTestCategory(ctx.db, ctx.testData.userId, subjectId)
      const { id: deletedTopicId } = createTestTopic(ctx.db, ctx.testData.userId, categoryId, {
        deletedAt: new Date(),
      })
      createProgressTestData(ctx.db, ctx.testData.userId, deletedTopicId)

      // 通常のトピック
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)

      const res = await app.request("/learning/topics/recent", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, recentTopicsResponseSchema)
      expect(body.topics.length).toBe(1)
      expect(body.topics[0].topicId).toBe(ctx.testData.topicId)
    })
  })

  describe("GET /learning/subjects/progress-stats - 科目別進捗統計", () => {
    it("科目別の進捗統計を取得できる", async () => {
      const res = await app.request("/learning/subjects/progress-stats", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, subjectProgressStatsResponseSchema)
      expect(Array.isArray(body.stats)).toBe(true)
      body.stats.forEach((stat) => {
        expect(stat.subjectId).toBeTruthy()
        expect(stat.subjectName).toBeTruthy()
        expect(typeof stat.totalTopics).toBe("number")
        expect(typeof stat.understoodTopics).toBe("number")
      })
    })

    it("understoodTopicsが正しくカウントされる", async () => {
      // トピックを理解済みにする
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)

      const res = await app.request("/learning/subjects/progress-stats", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, subjectProgressStatsResponseSchema)
      const subjectStat = body.stats.find((s) => s.subjectId === ctx.testData.subjectId)
      expect(subjectStat).toBeDefined()
      expect(subjectStat?.understoodTopics).toBeGreaterThanOrEqual(1)
    })

    it("他ユーザーの科目は含まれない", async () => {
      const res = await app.request("/learning/subjects/progress-stats", {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, subjectProgressStatsResponseSchema)
      // 他ユーザーは科目を持っていないので空
      expect(body.stats).toEqual([])
    })
  })

  describe("GET /learning/progress - ユーザー進捗一覧", () => {
    it("ユーザーの全進捗を取得できる", async () => {
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)
      createProgressTestData(ctx.db, ctx.testData.userId, additionalData.topic2Id)

      const res = await app.request("/learning/progress", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressListResponseSchema)
      expect(body.progress.length).toBe(2)
    })

    it("進捗がない場合は空配列を返す", async () => {
      const res = await app.request("/learning/progress", {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressListResponseSchema)
      expect(body.progress).toEqual([])
    })

    it("他ユーザーの進捗は含まれない", async () => {
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)
      createProgressTestData(ctx.db, additionalData.otherUserId, ctx.testData.topicId)

      const res = await app.request("/learning/progress", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressListResponseSchema)
      expect(body.progress.length).toBe(1)
      expect(body.progress[0].userId).toBe(ctx.testData.userId)
    })
  })

  describe("認証エラー", () => {
    it("本番環境で認証なしの場合は401を返す（POST /learning/topics/:topicId/touch）", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = learningRoutes({ db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/learning", routes)

      const res = await prodApp.request(`/learning/topics/${ctx.testData.topicId}/touch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("認証が必要です")
    })

    it("本番環境で認証なしの場合は401を返す（GET /learning/topics/recent）", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = learningRoutes({ db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/learning", routes)

      const res = await prodApp.request("/learning/topics/recent", {
        headers: { "Content-Type": "application/json" },
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("認証が必要です")
    })

    it("本番環境で認証なしの場合は401を返す（GET /learning/subjects/progress-stats）", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = learningRoutes({ db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/learning", routes)

      const res = await prodApp.request("/learning/subjects/progress-stats", {
        headers: { "Content-Type": "application/json" },
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("認証が必要です")
    })
  })
})
