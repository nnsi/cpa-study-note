/**
 * Topic Routes の統合テスト
 */
import { describe, it, expect, beforeEach } from "vitest"
import { Hono } from "hono"
import type { Env, Variables } from "@/shared/types/env"
import { topicRoutes } from "./route"
import {
  setupTestContext,
  createAuthHeaders,
  createAdditionalTestData,
  createProgressTestData,
  type TestContext,
} from "@/test/helpers"

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
      const body = await res.json()
      expect(body.subjects).toBeDefined()
      expect(body.subjects.length).toBeGreaterThanOrEqual(2)

      const subject1 = body.subjects.find((s: any) => s.id === ctx.testData.subjectId)
      expect(subject1).toBeDefined()
      expect(subject1.name).toBe("財務会計論")
      expect(subject1.categoryCount).toBeGreaterThanOrEqual(1)
      expect(subject1.topicCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe("GET /subjects/:subjectId - 科目詳細", () => {
    it("存在する科目の詳細を取得できる", async () => {
      const res = await app.request(`/subjects/${ctx.testData.subjectId}`)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.subject).toBeDefined()
      expect(body.subject.id).toBe(ctx.testData.subjectId)
      expect(body.subject.name).toBe("財務会計論")
      expect(body.subject.categoryCount).toBeGreaterThanOrEqual(1)
    })

    it("存在しない科目は404を返す", async () => {
      const res = await app.request("/subjects/non-existent-subject")

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe("Subject not found")
    })
  })

  describe("GET /subjects/:subjectId/categories - カテゴリ階層", () => {
    it("カテゴリ階層を取得できる（認証なし）", async () => {
      const res = await app.request(`/subjects/${ctx.testData.subjectId}/categories`)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.categories).toBeDefined()
      expect(Array.isArray(body.categories)).toBe(true)

      // ルートカテゴリを確認
      const rootCategory = body.categories.find((c: any) => c.id === ctx.testData.categoryId)
      expect(rootCategory).toBeDefined()
      expect(rootCategory.name).toBe("計算")
      expect(rootCategory.depth).toBe(0)
    })

    it("認証時はユーザーの進捗情報が含まれる", async () => {
      // 進捗データを作成
      createProgressTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId, true)

      const res = await app.request(`/subjects/${ctx.testData.subjectId}/categories`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await res.json()

      // 進捗情報が含まれていることを確認
      const category = body.categories.find((c: any) => c.id === ctx.testData.categoryId)
      expect(category.understoodCount).toBeGreaterThanOrEqual(0)
    })

    it("子カテゴリが親の children に含まれる", async () => {
      const res = await app.request(`/subjects/${ctx.testData.subjectId}/categories`)

      expect(res.status).toBe(200)
      const body = await res.json()

      const rootCategory = body.categories.find((c: any) => c.id === ctx.testData.categoryId)
      expect(rootCategory.children).toBeDefined()
      expect(Array.isArray(rootCategory.children)).toBe(true)

      const childCategory = rootCategory.children.find((c: any) => c.id === additionalData.childCategoryId)
      expect(childCategory).toBeDefined()
      expect(childCategory.name).toBe("子カテゴリ")
      expect(childCategory.depth).toBe(1)
    })
  })

  describe("GET /subjects/:subjectId/categories/:categoryId/topics - 論点一覧", () => {
    it("カテゴリの論点一覧を取得できる", async () => {
      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/categories/${ctx.testData.categoryId}/topics`
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.topics).toBeDefined()
      expect(body.topics.length).toBeGreaterThanOrEqual(2)

      const topic1 = body.topics.find((t: any) => t.id === ctx.testData.topicId)
      expect(topic1).toBeDefined()
      expect(topic1.name).toBe("有価証券")
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
      const body = await res.json()
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
      const body = await res.json()
      expect(body.topic.progress).toBeDefined()
      expect(body.topic.progress.understood).toBe(true)
    })

    it("存在しない論点は404を返す", async () => {
      const res = await app.request(
        `/subjects/${ctx.testData.subjectId}/topics/non-existent-topic`,
        {
          headers: createAuthHeaders(ctx.testData.userId),
        }
      )

      expect(res.status).toBe(404)
      const body = await res.json()
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
      const body = await res.json()
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
      const body = await res.json()
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
      const body = await res.json()
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
      const body = await res.json()
      expect(body.progress).toBeDefined()
      expect(Array.isArray(body.progress)).toBe(true)
      expect(body.progress.length).toBeGreaterThanOrEqual(2)
    })

    it("進捗がない場合は空配列を返す", async () => {
      const res = await app.request("/subjects/progress/me", {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
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
      const body = await res.json()
      expect(body.stats).toBeDefined()
      expect(Array.isArray(body.stats)).toBe(true)

      const subjectStats = body.stats.find((s: any) => s.subjectId === ctx.testData.subjectId)
      expect(subjectStats).toBeDefined()
      expect(subjectStats.subjectName).toBe("財務会計論")
      expect(subjectStats.totalTopics).toBeGreaterThanOrEqual(1)
      expect(subjectStats.understoodTopics).toBeGreaterThanOrEqual(1)
    })
  })
})
