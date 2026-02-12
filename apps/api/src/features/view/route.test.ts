/// <reference types="@cloudflare/workers-types" />
/**
 * View Routes の統合テスト
 *
 * View featureは読み取り専用であることを保証するテスト
 * - 全てのエンドポイントがSELECTのみを実行
 * - INSERT/UPDATE/DELETEが呼ばれないことを検証
 */
import { describe, it, expect, beforeEach } from "vitest"
import { Hono } from "hono"
import { z } from "zod"
import type { Env, Variables } from "../../shared/types/env"
import { viewRoutes } from "./route"
import {
  setupTestContext,
  createAuthHeaders,
  createAdditionalTestData,
  createProgressTestData,
  createNoteTestData,
  parseJson,
  type TestContext,
} from "../../test/helpers"
import { loggerMiddleware } from "../../shared/middleware/logger"
import * as schema from "@cpa-study/db/schema"

// レスポンススキーマ定義
const topicViewSchema = z.object({
  topic: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    categoryId: z.string(),
    categoryName: z.string(),
    subjectId: z.string(),
    subjectName: z.string(),
    difficulty: z.string().nullable(),
    topicType: z.string().nullable(),
    displayOrder: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  progress: z
    .object({
      id: z.string(),
      userId: z.string(),
      topicId: z.string(),
      understood: z.boolean(),
      lastAccessedAt: z.string().nullable(),
      questionCount: z.number(),
      goodQuestionCount: z.number(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
    .nullable(),
  recentNotes: z.array(
    z.object({
      id: z.string(),
      title: z.string().nullable(),
      updatedAt: z.string(),
    })
  ),
  recentSessions: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string(),
    })
  ),
})

const subjectDashboardSchema = z.object({
  subject: z.object({
    id: z.string(),
    name: z.string(),
    emoji: z.string().nullable(),
    color: z.string().nullable(),
  }),
  stats: z.object({
    categoryCount: z.number(),
    topicCount: z.number(),
    completedCount: z.number(),
    progressPercentage: z.number(),
  }),
  recentTopics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      lastAccessedAt: z.string().nullable(),
    })
  ),
})

const reviewListSchema = z.object({
  topics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      subjectId: z.string(),
      subjectName: z.string(),
      categoryId: z.string(),
      understood: z.boolean(),
      lastAccessedAt: z.string().nullable(),
      sessionCount: z.number(),
    })
  ),
  total: z.number(),
})

const categoryTopicsSchema = z.object({
  category: z.object({
    id: z.string(),
    name: z.string(),
  }),
  topics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      displayOrder: z.number(),
    })
  ),
})

const searchSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      subjectId: z.string(),
      subjectName: z.string(),
      categoryId: z.string(),
      categoryName: z.string(),
    })
  ),
  total: z.number(),
})

/**
 * DBの全テーブルの行数を取得するスナップショット関数
 */
const getDbSnapshot = (db: TestContext["db"]) => {
  return {
    users: db.select().from(schema.users).all().length,
    studyDomains: db.select().from(schema.studyDomains).all().length,
    subjects: db.select().from(schema.subjects).all().length,
    categories: db.select().from(schema.categories).all().length,
    topics: db.select().from(schema.topics).all().length,
    userTopicProgress: db.select().from(schema.userTopicProgress).all().length,
    notes: db.select().from(schema.notes).all().length,
    chatSessions: db.select().from(schema.chatSessions).all().length,
    chatMessages: db.select().from(schema.chatMessages).all().length,
    images: db.select().from(schema.images).all().length,
  }
}

/**
 * DBの全テーブルの内容をハッシュとして取得（内容変更の検出用）
 */
const getDbContentHash = (db: TestContext["db"]) => {
  const users = JSON.stringify(db.select().from(schema.users).all())
  const studyDomains = JSON.stringify(db.select().from(schema.studyDomains).all())
  const subjects = JSON.stringify(db.select().from(schema.subjects).all())
  const categories = JSON.stringify(db.select().from(schema.categories).all())
  const topics = JSON.stringify(db.select().from(schema.topics).all())
  const progress = JSON.stringify(db.select().from(schema.userTopicProgress).all())
  const notes = JSON.stringify(db.select().from(schema.notes).all())
  const sessions = JSON.stringify(db.select().from(schema.chatSessions).all())
  const messages = JSON.stringify(db.select().from(schema.chatMessages).all())

  return {
    users,
    studyDomains,
    subjects,
    categories,
    topics,
    progress,
    notes,
    sessions,
    messages,
  }
}

describe("View Routes - Read-Only Guarantee", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let additionalData: ReturnType<typeof createAdditionalTestData>

  beforeEach(() => {
    ctx = setupTestContext()
    additionalData = createAdditionalTestData(ctx.db, ctx.testData)

    // 進捗データとノートデータを追加
    createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)
    createNoteTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)

    // ルートを作成
    const routes = viewRoutes({ db: ctx.db as any })

    // メインアプリにマウント
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, ctx.env)
      await next()
    })
    app.use("*", loggerMiddleware())
    app.route("/view", routes)
  })

  describe("GET /view/topics/:topicId - 論点詳細ビュー", () => {
    it("DBを変更せずにデータを取得できる", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request(`/view/topics/${ctx.testData.topicId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, topicViewSchema)
      expect(body.topic.id).toBe(ctx.testData.topicId)

      // DBが変更されていないことを確認
      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })

    it("存在しない論点でも404を返しDBを変更しない", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request("/view/topics/non-existent", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })
  })

  describe("GET /view/subjects/:subjectId/dashboard - 科目ダッシュボード", () => {
    it("DBを変更せずにデータを取得できる", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request(`/view/subjects/${ctx.testData.subjectId}/dashboard`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, subjectDashboardSchema)
      expect(body.subject.id).toBe(ctx.testData.subjectId)

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })

    it("存在しない科目でも404を返しDBを変更しない", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request("/view/subjects/non-existent/dashboard", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })
  })

  describe("GET /view/topics - レビューリスト", () => {
    it("DBを変更せずに一覧を取得できる", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request("/view/topics", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, reviewListSchema)
      expect(Array.isArray(body.topics)).toBe(true)

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })

    it("フィルタ付きでもDBを変更しない", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request("/view/topics?understood=true&limit=10", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      await parseJson(res, reviewListSchema)

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })
  })

  describe("GET /view/categories/:categoryId/topics - 単元別論点一覧", () => {
    it("DBを変更せずにデータを取得できる", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request(`/view/categories/${ctx.testData.categoryId}/topics`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, categoryTopicsSchema)
      expect(body.category.id).toBe(ctx.testData.categoryId)

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })

    it("存在しないカテゴリでも404を返しDBを変更しない", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request("/view/categories/non-existent/topics", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })
  })

  describe("GET /view/search - 論点検索", () => {
    it("DBを変更せずに検索できる", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request("/view/search?q=有価証券", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, searchSchema)
      expect(Array.isArray(body.results)).toBe(true)

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })

    it("空の検索結果でもDBを変更しない", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request("/view/search?q=存在しない論点", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, searchSchema)
      expect(body.results).toEqual([])

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })

    it("studyDomainIdフィルタ付きでもDBを変更しない", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      const res = await app.request(`/view/search?q=有価&studyDomainId=${ctx.testData.studyDomainId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      await parseJson(res, searchSchema)

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })
  })

  describe("複数回呼び出しでも冪等性を保証", () => {
    it("同じエンドポイントを複数回呼び出してもDBが変更されない", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      // 5回連続で各エンドポイントを呼び出し
      for (let i = 0; i < 5; i++) {
        await app.request(`/view/topics/${ctx.testData.topicId}`, {
          headers: createAuthHeaders(ctx.testData.userId),
        })
        await app.request(`/view/subjects/${ctx.testData.subjectId}/dashboard`, {
          headers: createAuthHeaders(ctx.testData.userId),
        })
        await app.request("/view/topics", {
          headers: createAuthHeaders(ctx.testData.userId),
        })
        await app.request(`/view/categories/${ctx.testData.categoryId}/topics`, {
          headers: createAuthHeaders(ctx.testData.userId),
        })
        await app.request("/view/search?q=有", {
          headers: createAuthHeaders(ctx.testData.userId),
        })
      }

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })
  })

  describe("他ユーザーのデータにアクセスしてもDBを変更しない", () => {
    it("権限のないデータへのアクセスでDBが変更されない", async () => {
      const snapshotBefore = getDbSnapshot(ctx.db)
      const contentBefore = getDbContentHash(ctx.db)

      // 他ユーザーとしてアクセス
      const res = await app.request(`/view/topics/${ctx.testData.topicId}`, {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      // 404 or 403のいずれか（実装による）
      expect([403, 404]).toContain(res.status)

      const snapshotAfter = getDbSnapshot(ctx.db)
      const contentAfter = getDbContentHash(ctx.db)

      expect(snapshotAfter).toEqual(snapshotBefore)
      expect(contentAfter).toEqual(contentBefore)
    })
  })
})

describe("View Routes - Functional Tests", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>

  beforeEach(() => {
    ctx = setupTestContext()
    createAdditionalTestData(ctx.db, ctx.testData)

    // テストデータを追加
    createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)
    createNoteTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)

    const routes = viewRoutes({ db: ctx.db as any })
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, ctx.env)
      await next()
    })
    app.use("*", loggerMiddleware())
    app.route("/view", routes)
  })

  describe("GET /view/topics/:topicId", () => {
    it("論点詳細を正しく取得できる", async () => {
      const res = await app.request(`/view/topics/${ctx.testData.topicId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, topicViewSchema)
      expect(body.topic.id).toBe(ctx.testData.topicId)
      expect(body.topic.name).toBe("有価証券")
      expect(body.topic.subjectName).toBe("財務会計論")
      expect(body.topic.categoryName).toBe("計算")
      expect(body.progress).not.toBeNull()
      expect(body.progress?.understood).toBe(true)
    })
  })

  describe("GET /view/subjects/:subjectId/dashboard", () => {
    it("科目ダッシュボードを正しく取得できる", async () => {
      const res = await app.request(`/view/subjects/${ctx.testData.subjectId}/dashboard`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, subjectDashboardSchema)
      expect(body.subject.id).toBe(ctx.testData.subjectId)
      expect(body.subject.name).toBe("財務会計論")
      expect(body.stats.categoryCount).toBeGreaterThanOrEqual(1)
      expect(body.stats.topicCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe("GET /view/topics", () => {
    it("レビューリストを正しく取得できる", async () => {
      const res = await app.request("/view/topics", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, reviewListSchema)
      expect(body.topics.length).toBeGreaterThan(0)
      expect(body.total).toBeGreaterThan(0)
    })

    it("understood=trueでフィルタできる", async () => {
      const res = await app.request("/view/topics?understood=true", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, reviewListSchema)
      body.topics.forEach((topic) => {
        expect(topic.understood).toBe(true)
      })
    })
  })

  describe("GET /view/categories/:categoryId/topics", () => {
    it("単元別論点一覧を正しく取得できる", async () => {
      const res = await app.request(`/view/categories/${ctx.testData.categoryId}/topics`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, categoryTopicsSchema)
      expect(body.category.id).toBe(ctx.testData.categoryId)
      expect(body.topics.length).toBeGreaterThan(0)
    })
  })

  describe("GET /view/search", () => {
    it("論点を検索できる", async () => {
      const res = await app.request("/view/search?q=有価証券", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, searchSchema)
      expect(body.results.length).toBeGreaterThan(0)
      expect(body.results[0].name).toContain("有価証券")
    })

    it("部分一致で検索できる", async () => {
      const res = await app.request("/view/search?q=有価", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, searchSchema)
      expect(body.results.length).toBeGreaterThan(0)
    })

    it("検索結果がない場合は空配列を返す", async () => {
      const res = await app.request("/view/search?q=存在しない論点名", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, searchSchema)
      expect(body.results).toEqual([])
      expect(body.total).toBe(0)
    })
  })
})
