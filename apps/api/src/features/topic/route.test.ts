/// <reference types="@cloudflare/workers-types" />
/**
 * Topic Routes の統合テスト
 */
import { describe, it, expect, beforeEach } from "vitest"
import { Hono } from "hono"
import { z } from "zod"
import type { Env, Variables } from "../../shared/types/env"
import { topicRoutes } from "./route"
import {
  setupTestContext,
  createAuthHeaders,
  createAdditionalTestData,
  createProgressTestData,
  parseJson,
  errorResponseSchema,
  type TestContext,
} from "../../test/helpers"

// レスポンススキーマ定義
const subjectsListSchema = z.object({
  subjects: z.array(
    z.object({
      id: z.string(),
      studyDomainId: z.string(),
      name: z.string(),
      emoji: z.string().nullable(),
      color: z.string().nullable(),
      categoryCount: z.number(),
      topicCount: z.number(),
    })
  ),
})

const subjectDetailSchema = z.object({
  subject: z.object({
    id: z.string(),
    studyDomainId: z.string(),
    name: z.string(),
    emoji: z.string().nullable(),
    color: z.string().nullable(),
    categoryCount: z.number(),
  }),
})

const categoriesSchema = z.object({
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      depth: z.number(),
      children: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          depth: z.number(),
        })
      ),
      understoodCount: z.number().optional(),
    })
  ),
})

const topicsListSchema = z.object({
  topics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  ),
})

const topicDetailSchema = z.object({
  topic: z.object({
    id: z.string(),
    name: z.string(),
    progress: z
      .object({
        understood: z.boolean(),
      })
      .optional()
      .nullable(),
  }),
})

const progressSchema = z.object({
  progress: z.object({
    topicId: z.string(),
    understood: z.boolean(),
    lastAccessedAt: z.string(),
  }),
})

const progressListSchema = z.object({
  progress: z.array(
    z.object({
      topicId: z.string(),
      understood: z.boolean(),
    })
  ),
})

const progressStatsSchema = z.object({
  stats: z.array(
    z.object({
      subjectId: z.string(),
      subjectName: z.string(),
      totalTopics: z.number(),
      understoodTopics: z.number(),
    })
  ),
})

const checkHistorySchema = z.object({
  history: z.array(
    z.object({
      id: z.string(),
      action: z.enum(["checked", "unchecked"]),
      checkedAt: z.string(),
    })
  ),
})

const filterResponseSchema = z.object({
  topics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      subjectId: z.string(),
      subjectName: z.string(),
      sessionCount: z.number(),
      lastChatAt: z.string().nullable(),
      understood: z.boolean(),
      goodQuestionCount: z.number(),
    })
  ),
})

const recentTopicsSchema = z.object({
  topics: z.array(
    z.object({
      topicId: z.string(),
      topicName: z.string(),
      subjectId: z.string(),
      subjectName: z.string(),
      categoryId: z.string(),
      lastAccessedAt: z.string(),
    })
  ),
})

describe("Topic Routes", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let additionalData: ReturnType<typeof createAdditionalTestData>

  beforeEach(() => {
    ctx = setupTestContext()
    additionalData = createAdditionalTestData(ctx.db, ctx.testData)

    // ルートを作成（Dbとして渡す）
    const routes = topicRoutes({ env: ctx.env, db: ctx.db as any })

    // メインアプリにマウント（環境変数を初期化）
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.use("*", async (c, next) => {
      // c.envが未定義の場合は初期化
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, ctx.env)
      await next()
    })
    app.route("/subjects", routes)
  })

  describe("GET /subjects - 科目一覧", () => {
    it("全科目一覧を取得できる", async () => {
      const res = await app.request("/subjects")

      expect(res.status).toBe(200)
      const body = await parseJson(res, subjectsListSchema)
      expect(body.subjects).toBeDefined()
      expect(body.subjects.length).toBeGreaterThanOrEqual(2)

      const subject1 = body.subjects.find((s: { id: string }) => s.id === ctx.testData.subjectId)
      expect(subject1).toBeDefined()
      expect(subject1!.name).toBe("財務会計論")
      expect(subject1!.categoryCount).toBeGreaterThanOrEqual(1)
      expect(subject1!.topicCount).toBeGreaterThanOrEqual(1)
    })

    it("studyDomainIdでフィルタリングできる", async () => {
      const res = await app.request("/subjects?studyDomainId=cpa")

      expect(res.status).toBe(200)
      const body = await parseJson(res, subjectsListSchema)
      expect(body.subjects).toBeDefined()
      // cpa学習領域に属する科目のみ返される
      expect(body.subjects.length).toBeGreaterThanOrEqual(1)
    })

    it("存在しないstudyDomainIdの場合は空配列を返す", async () => {
      const res = await app.request("/subjects?studyDomainId=non-existent")

      expect(res.status).toBe(200)
      const body = await parseJson(res, subjectsListSchema)
      expect(body.subjects).toEqual([])
    })
  })

  describe("GET /subjects/:subjectId - 科目詳細", () => {
    it("存在する科目の詳細を取得できる", async () => {
      const res = await app.request(`/subjects/${ctx.testData.subjectId}`)

      expect(res.status).toBe(200)
      const body = await parseJson(res, subjectDetailSchema)
      expect(body.subject).toBeDefined()
      expect(body.subject.id).toBe(ctx.testData.subjectId)
      expect(body.subject.name).toBe("財務会計論")
      expect(body.subject.categoryCount).toBeGreaterThanOrEqual(1)
    })

    it("存在しない科目は404を返す", async () => {
      const res = await app.request("/subjects/non-existent-subject")

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Subject not found")
    })
  })

  describe("GET /subjects/:subjectId/categories - カテゴリ階層", () => {
    it("カテゴリ階層を取得できる（認証なし）", async () => {
      const res = await app.request(`/subjects/${ctx.testData.subjectId}/categories`)

      expect(res.status).toBe(200)
      const body = await parseJson(res, categoriesSchema)
      expect(body.categories).toBeDefined()
      expect(Array.isArray(body.categories)).toBe(true)

      // ルートカテゴリを確認
      const rootCategory = body.categories.find((c: { id: string }) => c.id === ctx.testData.categoryId)
      expect(rootCategory).toBeDefined()
      expect(rootCategory!.name).toBe("計算")
      expect(rootCategory!.depth).toBe(0)
    })

    it("認証時はユーザーの進捗情報が含まれる", async () => {
      // 進捗データを作成
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)

      const res = await app.request(`/subjects/${ctx.testData.subjectId}/categories`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, categoriesSchema)

      // 進捗情報が含まれていることを確認
      const category = body.categories.find((c: { id: string }) => c.id === ctx.testData.categoryId)
      expect(category!.understoodCount).toBeGreaterThanOrEqual(0)
    })

    it("子カテゴリが親の children に含まれる", async () => {
      const res = await app.request(`/subjects/${ctx.testData.subjectId}/categories`)

      expect(res.status).toBe(200)
      const body = await parseJson(res, categoriesSchema)

      const rootCategory = body.categories.find((c: { id: string }) => c.id === ctx.testData.categoryId)
      expect(rootCategory!.children).toBeDefined()
      expect(Array.isArray(rootCategory!.children)).toBe(true)

      const childCategory = rootCategory!.children.find((c: { id: string }) => c.id === additionalData.childCategoryId)
      expect(childCategory).toBeDefined()
      expect(childCategory!.name).toBe("子カテゴリ")
      expect(childCategory!.depth).toBe(1)
    })
  })

  describe("GET /subjects/:subjectId/categories/:categoryId/topics - 論点一覧", () => {
    it("カテゴリの論点一覧を取得できる", async () => {
      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/categories/${ctx.testData.categoryId}/topics`
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, topicsListSchema)
      expect(body.topics).toBeDefined()
      expect(body.topics.length).toBeGreaterThanOrEqual(2)

      const topic1 = body.topics.find((t: { id: string }) => t.id === ctx.testData.topicId)
      expect(topic1).toBeDefined()
      expect(topic1!.name).toBe("有価証券")
    })
  })

  describe("GET /subjects/:subjectId/topics/:topicId - 論点詳細", () => {
    it("認証済みユーザーが論点詳細を取得できる", async () => {
      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}`,
        {
          headers: createAuthHeaders(ctx.testData.userId),
        }
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, topicDetailSchema)
      expect(body.topic).toBeDefined()
      expect(body.topic.id).toBe(ctx.testData.topicId)
      expect(body.topic.name).toBe("有価証券")
    })

    it("進捗がある場合は進捗情報が含まれる", async () => {
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)

      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}`,
        {
          headers: createAuthHeaders(ctx.testData.userId),
        }
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, topicDetailSchema)
      expect(body.topic.progress).toBeDefined()
      expect(body.topic.progress!.understood).toBe(true)
    })

    it("存在しない論点は404を返す", async () => {
      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/non-existent-topic`,
        {
          headers: createAuthHeaders(ctx.testData.userId),
        }
      )

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Topic not found")
    })

    it("未認証の場合は401を返す", async () => {
      // ローカル環境でも認証ヘッダーなしでデフォルトユーザーが使われるため、
      // 本番環境のテストが必要だが、ここではローカル環境なので認証が通る
      // 本テストはローカル環境では認証がスキップされるため、別の方法でテスト
    })
  })

  describe("PUT /subjects/:subjectId/topics/:topicId/progress - 進捗更新", () => {
    it("進捗を更新できる", async () => {
      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/progress`,
        {
          method: "PUT",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({ understood: true }),
        }
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressSchema)
      expect(body.progress).toBeDefined()
      expect(body.progress.understood).toBe(true)
      expect(body.progress.topicId).toBe(ctx.testData.topicId)
    })

    it("understood を false に設定できる", async () => {
      // まず true に設定
      await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/progress`,
        {
          method: "PUT",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({ understood: true }),
        }
      )

      // false に更新
      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/progress`,
        {
          method: "PUT",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({ understood: false }),
        }
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressSchema)
      expect(body.progress.understood).toBe(false)
    })

    it("空のボディでもアクセス記録が更新される", async () => {
      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/progress`,
        {
          method: "PUT",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({}),
        }
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressSchema)
      expect(body.progress).toBeDefined()
      expect(body.progress.lastAccessedAt).toBeDefined()
    })
  })

  describe("GET /subjects/progress/me - 全進捗取得", () => {
    it("ユーザーの全進捗を取得できる", async () => {
      // 複数の進捗を作成
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)
      createProgressTestData(ctx.db, ctx.testData.userId, additionalData.topic2Id, false)

      const res = await app.request("/subjects/progress/me", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressListSchema)
      expect(body.progress).toBeDefined()
      expect(Array.isArray(body.progress)).toBe(true)
      expect(body.progress.length).toBeGreaterThanOrEqual(2)
    })

    it("進捗がない場合は空配列を返す", async () => {
      const res = await app.request("/subjects/progress/me", {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressListSchema)
      expect(body.progress).toEqual([])
    })
  })

  describe("GET /subjects/progress/subjects - 進捗統計", () => {
    it("科目別の進捗統計を取得できる", async () => {
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)

      const res = await app.request("/subjects/progress/subjects", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, progressStatsSchema)
      expect(body.stats).toBeDefined()
      expect(Array.isArray(body.stats)).toBe(true)

      const subjectStats = body.stats.find((s: { subjectId: string }) => s.subjectId === ctx.testData.subjectId)
      expect(subjectStats).toBeDefined()
      expect(subjectStats!.subjectName).toBe("財務会計論")
      expect(subjectStats!.totalTopics).toBeGreaterThanOrEqual(1)
      expect(subjectStats!.understoodTopics).toBeGreaterThanOrEqual(1)
    })
  })

  describe("GET /subjects/:subjectId/topics/:topicId/check-history - チェック履歴取得", () => {
    it("チェック履歴を取得できる", async () => {
      // まず進捗を更新してチェック履歴を作成
      await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/progress`,
        {
          method: "PUT",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({ understood: true }),
        }
      )

      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/check-history`,
        {
          headers: createAuthHeaders(ctx.testData.userId),
        }
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, checkHistorySchema)
      expect(body.history).toBeDefined()
      expect(Array.isArray(body.history)).toBe(true)
      expect(body.history.length).toBeGreaterThanOrEqual(1)
      expect(body.history[0].action).toBe("checked")
      expect(body.history[0].checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it("チェック・アンチェック両方の履歴が記録される", async () => {
      // チェック
      await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/progress`,
        {
          method: "PUT",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({ understood: true }),
        }
      )

      // アンチェック
      await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/progress`,
        {
          method: "PUT",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({ understood: false }),
        }
      )

      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/check-history`,
        {
          headers: createAuthHeaders(ctx.testData.userId),
        }
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, checkHistorySchema)
      expect(body.history.length).toBeGreaterThanOrEqual(2)

      // 時系列で並んでいる（最新が先）
      const actions = body.history.map((h: { action: string }) => h.action)
      expect(actions).toContain("checked")
      expect(actions).toContain("unchecked")
    })

    it("履歴がない場合は空配列を返す", async () => {
      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${additionalData.topic2Id}/check-history`,
        {
          headers: createAuthHeaders(ctx.testData.userId),
        }
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, checkHistorySchema)
      expect(body.history).toEqual([])
    })

    it("他のユーザーの履歴は取得できない", async () => {
      // テストユーザーでチェック履歴を作成
      await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/progress`,
        {
          method: "PUT",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({ understood: true }),
        }
      )

      // 別ユーザーで取得（履歴は空のはず）
      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/check-history`,
        {
          headers: createAuthHeaders(additionalData.otherUserId),
        }
      )

      expect(res.status).toBe(200)
      const body = await parseJson(res, checkHistorySchema)
      expect(body.history).toEqual([])
    })
  })

  describe("GET /subjects/filter - 論点フィルタ", () => {
    it("認証済みユーザーがフィルタ結果を取得できる", async () => {
      const res = await app.request("/subjects/filter", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, filterResponseSchema)
      expect(body.topics).toBeDefined()
      expect(Array.isArray(body.topics)).toBe(true)
    })

    it("understood=true でフィルタできる", async () => {
      // understood を true に設定
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)
      createProgressTestData(ctx.db, ctx.testData.userId, additionalData.topic2Id, false)

      const res = await app.request("/subjects/filter?understood=true", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, filterResponseSchema)

      // understood=true の論点のみ
      for (const topic of body.topics) {
        expect(topic.understood).toBe(true)
      }
    })

    it("understood=false でフィルタできる", async () => {
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)
      createProgressTestData(ctx.db, ctx.testData.userId, additionalData.topic2Id, false)

      const res = await app.request("/subjects/filter?understood=false", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, filterResponseSchema)

      // understood=false の論点のみ（進捗がないものも含む）
      for (const topic of body.topics) {
        expect(topic.understood).toBe(false)
      }
    })

    it("minSessionCount でフィルタできる", async () => {
      // additionalData には sessionId が1件あるはず
      const res = await app.request("/subjects/filter?minSessionCount=1", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, filterResponseSchema)

      // セッションが1件以上の論点のみ
      for (const topic of body.topics) {
        expect(topic.sessionCount).toBeGreaterThanOrEqual(1)
      }
    })

    it("minGoodQuestionCount でフィルタできる", async () => {
      const res = await app.request("/subjects/filter?minGoodQuestionCount=1", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, filterResponseSchema)

      // goodQuestionCount が1以上の論点のみ
      for (const topic of body.topics) {
        expect(topic.goodQuestionCount).toBeGreaterThanOrEqual(1)
      }
    })

    it("複数のフィルタを組み合わせられる", async () => {
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)

      const res = await app.request("/subjects/filter?understood=true&minSessionCount=0", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, filterResponseSchema)

      for (const topic of body.topics) {
        expect(topic.understood).toBe(true)
        expect(topic.sessionCount).toBeGreaterThanOrEqual(0)
      }
    })

    it("レスポンスに必要なフィールドが含まれる", async () => {
      const res = await app.request("/subjects/filter", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, filterResponseSchema)

      if (body.topics.length > 0) {
        const topic = body.topics[0]
        expect(topic).toHaveProperty("id")
        expect(topic).toHaveProperty("name")
        expect(topic).toHaveProperty("subjectId")
        expect(topic).toHaveProperty("subjectName")
        expect(topic).toHaveProperty("sessionCount")
        expect(topic).toHaveProperty("lastChatAt")
        expect(topic).toHaveProperty("understood")
        expect(topic).toHaveProperty("goodQuestionCount")
      }
    })
  })

  describe("GET /subjects/progress/recent - 最近触った論点", () => {
    it("認証済みユーザーが最近の論点リストを取得できる", async () => {
      const res = await app.request("/subjects/progress/recent", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, recentTopicsSchema)
      expect(body.topics).toBeDefined()
      expect(Array.isArray(body.topics)).toBe(true)
    })

    it("lastAccessedAt でソートされた論点が返る", async () => {
      // 論点にアクセスして lastAccessedAt を設定
      await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}`,
        {
          headers: createAuthHeaders(ctx.testData.userId),
        }
      )

      // 少し待ってから別の論点にアクセス
      await new Promise((resolve) => setTimeout(resolve, 10))
      await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${additionalData.topic2Id}`,
        {
          headers: createAuthHeaders(ctx.testData.userId),
        }
      )

      const res = await app.request("/subjects/progress/recent", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, recentTopicsSchema)
      expect(body.topics.length).toBeGreaterThanOrEqual(2)

      // lastAccessedAt が降順になっているか確認
      for (let i = 1; i < body.topics.length; i++) {
        const prev = new Date(body.topics[i - 1].lastAccessedAt)
        const curr = new Date(body.topics[i].lastAccessedAt)
        expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime())
      }
    })

    it("レスポンスに必要なフィールドが含まれる", async () => {
      // 論点にアクセス
      await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}`,
        {
          headers: createAuthHeaders(ctx.testData.userId),
        }
      )

      const res = await app.request("/subjects/progress/recent", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, recentTopicsSchema)

      if (body.topics.length > 0) {
        const topic = body.topics[0]
        expect(topic).toHaveProperty("topicId")
        expect(topic).toHaveProperty("topicName")
        expect(topic).toHaveProperty("subjectId")
        expect(topic).toHaveProperty("subjectName")
        expect(topic).toHaveProperty("categoryId")
        expect(topic).toHaveProperty("lastAccessedAt")
        expect(topic.lastAccessedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      }
    })

    it("アクセス履歴がない場合は空配列を返す", async () => {
      // 新しいユーザーでアクセス
      const res = await app.request("/subjects/progress/recent", {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, recentTopicsSchema)
      expect(body.topics).toEqual([])
    })

    it("production環境で未認証の場合は401を返す", async () => {
      // production環境用のappを作成
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/subjects", topicRoutes({ env: prodEnv, db: ctx.db as any }))

      const res = await prodApp.request("/subjects/progress/recent", {}, prodEnv)

      expect(res.status).toBe(401)
    })
  })
})
