/// <reference types="@cloudflare/workers-types" />
/**
 * StudyPlan Routes の統合テスト
 */
import { describe, it, expect, beforeEach } from "vitest"
import { Hono } from "hono"
import { z } from "zod"
import type { Env, Variables } from "../../shared/types/env"
import { studyPlanRoutes } from "./route"
import {
  setupTestContext,
  createAuthHeaders,
  parseJson,
  errorResponseSchema,
  type TestContext,
} from "../../test/helpers"
import { loggerMiddleware } from "../../shared/middleware/logger"

// レスポンススキーマ定義
const planSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  intent: z.string().nullable(),
  scope: z.string(),
  subjectId: z.string().nullable(),
  subjectName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
})

const planResponseSchema = z.object({
  plan: planSchema,
})

const plansListSchema = z.object({
  plans: z.array(
    planSchema.extend({
      itemCount: z.number(),
    })
  ),
})

const planDetailSchema = z.object({
  plan: planSchema,
  items: z.array(
    z.object({
      id: z.string(),
      studyPlanId: z.string(),
      topicId: z.string().nullable(),
      topicName: z.string().nullable(),
      description: z.string(),
      rationale: z.string().nullable(),
      orderIndex: z.number(),
      createdAt: z.string(),
    })
  ),
  revisions: z.array(
    z.object({
      id: z.string(),
      studyPlanId: z.string(),
      summary: z.string(),
      reason: z.string().nullable(),
      createdAt: z.string(),
    })
  ),
})

const itemResponseSchema = z.object({
  item: z.object({
    id: z.string(),
    studyPlanId: z.string(),
    topicId: z.string().nullable(),
    topicName: z.string().nullable(),
    description: z.string(),
    rationale: z.string().nullable(),
    orderIndex: z.number(),
    createdAt: z.string(),
  }),
})

const revisionResponseSchema = z.object({
  revision: z.object({
    id: z.string(),
    studyPlanId: z.string(),
    summary: z.string(),
    reason: z.string().nullable(),
    createdAt: z.string(),
  }),
})

// テスト用に計画を作成するヘルパー
const createTestPlan = async (
  app: Hono<{ Bindings: Env; Variables: Variables }>,
  userId: string,
  data: { title: string; scope: string; subjectId?: string; intent?: string } = { title: "テスト計画", scope: "all" }
) => {
  const res = await app.request("/study-plans", {
    method: "POST",
    headers: createAuthHeaders(userId),
    body: JSON.stringify(data),
  })
  const body = await parseJson(res, planResponseSchema)
  return body.plan
}

describe("StudyPlan Routes", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>

  beforeEach(() => {
    ctx = setupTestContext()

    const routes = studyPlanRoutes({ db: ctx.db as any })

    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.use("*", loggerMiddleware())
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, ctx.env)
      await next()
    })
    app.route("/study-plans", routes)
  })

  describe("POST /study-plans - 計画作成", () => {
    it("計画を作成できる", async () => {
      const res = await app.request("/study-plans", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          title: "財務会計学習計画",
          scope: "subject",
          subjectId: ctx.testData.subjectId,
          intent: "短答式対策",
        }),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, planResponseSchema)
      expect(body.plan.title).toBe("財務会計学習計画")
      expect(body.plan.scope).toBe("subject")
      expect(body.plan.subjectId).toBe(ctx.testData.subjectId)
      expect(body.plan.subjectName).toBe("財務会計論")
      expect(body.plan.intent).toBe("短答式対策")
    })

    it("最低限のフィールドで計画を作成できる", async () => {
      const res = await app.request("/study-plans", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          title: "シンプル計画",
          scope: "all",
        }),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, planResponseSchema)
      expect(body.plan.title).toBe("シンプル計画")
      expect(body.plan.intent).toBeNull()
      expect(body.plan.subjectId).toBeNull()
    })

    it("タイトルが空の場合は400を返す", async () => {
      const res = await app.request("/study-plans", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          title: "",
          scope: "all",
        }),
      })

      expect(res.status).toBe(400)
    })

    it("scopeが不正な場合は400を返す", async () => {
      const res = await app.request("/study-plans", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          title: "テスト",
          scope: "invalid_scope",
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe("GET /study-plans - 計画一覧", () => {
    it("計画一覧を取得できる", async () => {
      await createTestPlan(app, ctx.testData.userId, { title: "計画1", scope: "all" })
      await createTestPlan(app, ctx.testData.userId, { title: "計画2", scope: "subject", subjectId: ctx.testData.subjectId })

      const res = await app.request("/study-plans", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, plansListSchema)
      expect(body.plans).toHaveLength(2)
      body.plans.forEach((plan) => {
        expect(typeof plan.itemCount).toBe("number")
      })
    })

    it("計画がない場合は空配列を返す", async () => {
      const res = await app.request("/study-plans", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, plansListSchema)
      expect(body.plans).toEqual([])
    })

    it("archivedフィルタが機能する", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)
      // アーカイブ
      await app.request(`/study-plans/${plan.id}/archive`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      const res = await app.request("/study-plans?archived=true", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, plansListSchema)
      expect(body.plans).toHaveLength(1)
      expect(body.plans[0].archivedAt).not.toBeNull()
    })
  })

  describe("GET /study-plans/:planId - 計画詳細", () => {
    it("計画詳細を取得できる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, planDetailSchema)
      expect(body.plan.id).toBe(plan.id)
      expect(body.items).toBeDefined()
      expect(body.revisions).toBeDefined()
    })

    it("他ユーザーの計画は404を返す", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}`, {
        headers: createAuthHeaders("other-user"),
      })

      expect(res.status).toBe(404)
    })

    it("存在しない計画は404を返す", async () => {
      const res = await app.request("/study-plans/non-existent", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
    })
  })

  describe("PATCH /study-plans/:planId - 計画更新", () => {
    it("計画を更新できる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}`, {
        method: "PATCH",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ title: "更新後のタイトル" }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, planResponseSchema)
      expect(body.plan.title).toBe("更新後のタイトル")
    })

    it("他ユーザーの計画更新は404を返す", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}`, {
        method: "PATCH",
        headers: createAuthHeaders("other-user"),
        body: JSON.stringify({ title: "不正な更新" }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe("POST /study-plans/:planId/archive - アーカイブ", () => {
    it("計画をアーカイブできる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}/archive`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(204)
    })

    it("他ユーザーの計画アーカイブは404を返す", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}/archive`, {
        method: "POST",
        headers: createAuthHeaders("other-user"),
      })

      expect(res.status).toBe(404)
    })
  })

  describe("POST /study-plans/:planId/unarchive - アーカイブ解除", () => {
    it("計画のアーカイブを解除できる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)
      await app.request(`/study-plans/${plan.id}/archive`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      const res = await app.request(`/study-plans/${plan.id}/unarchive`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(204)
    })
  })

  describe("POST /study-plans/:planId/duplicate - 計画複製", () => {
    it("計画を複製できる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId, { title: "元の計画", scope: "all" })

      const res = await app.request(`/study-plans/${plan.id}/duplicate`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, planResponseSchema)
      expect(body.plan.title).toContain("（複製）")
      expect(body.plan.id).not.toBe(plan.id)
    })

    it("他ユーザーの計画複製は404を返す", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}/duplicate`, {
        method: "POST",
        headers: createAuthHeaders("other-user"),
      })

      expect(res.status).toBe(404)
    })
  })

  describe("POST /study-plans/:planId/items - 要素追加", () => {
    it("計画に要素を追加できる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}/items`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          description: "有価証券の学習",
          rationale: "基礎論点",
          orderIndex: 0,
        }),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, itemResponseSchema)
      expect(body.item.description).toBe("有価証券の学習")
      expect(body.item.rationale).toBe("基礎論点")
    })

    it("descriptionが空の場合は400を返す", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}/items`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          description: "",
          orderIndex: 0,
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe("PATCH /study-plans/:planId/items/:itemId - 要素更新", () => {
    it("要素を更新できる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)
      const addRes = await app.request(`/study-plans/${plan.id}/items`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ description: "元の説明", orderIndex: 0 }),
      })
      const addBody = await parseJson(addRes, itemResponseSchema)

      const res = await app.request(`/study-plans/${plan.id}/items/${addBody.item.id}`, {
        method: "PATCH",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ description: "更新後の説明" }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, itemResponseSchema)
      expect(body.item.description).toBe("更新後の説明")
    })
  })

  describe("DELETE /study-plans/:planId/items/:itemId - 要素削除", () => {
    it("要素を削除できる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)
      const addRes = await app.request(`/study-plans/${plan.id}/items`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ description: "削除対象", orderIndex: 0 }),
      })
      const addBody = await parseJson(addRes, itemResponseSchema)

      const res = await app.request(`/study-plans/${plan.id}/items/${addBody.item.id}`, {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(204)
    })

    it("他ユーザーの計画の要素削除は404を返す", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)
      const addRes = await app.request(`/study-plans/${plan.id}/items`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ description: "test", orderIndex: 0 }),
      })
      const addBody = await parseJson(addRes, itemResponseSchema)

      const res = await app.request(`/study-plans/${plan.id}/items/${addBody.item.id}`, {
        method: "DELETE",
        headers: createAuthHeaders("other-user"),
      })

      expect(res.status).toBe(404)
    })
  })

  describe("PUT /study-plans/:planId/items/reorder - 要素並べ替え", () => {
    it("要素を並べ替えできる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)
      const addRes1 = await app.request(`/study-plans/${plan.id}/items`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ description: "要素A", orderIndex: 0 }),
      })
      const addRes2 = await app.request(`/study-plans/${plan.id}/items`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ description: "要素B", orderIndex: 1 }),
      })
      const item1 = (await parseJson(addRes1, itemResponseSchema)).item
      const item2 = (await parseJson(addRes2, itemResponseSchema)).item

      const res = await app.request(`/study-plans/${plan.id}/items/reorder`, {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ itemIds: [item2.id, item1.id] }),
      })

      expect(res.status).toBe(204)
    })

    it("空のitemIdsは400を返す", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}/items/reorder`, {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ itemIds: [] }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe("POST /study-plans/:planId/revisions - 変遷記録追加", () => {
    it("変遷記録を追加できる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}/revisions`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          summary: "計画を修正",
          reason: "優先度の見直し",
        }),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, revisionResponseSchema)
      expect(body.revision.summary).toBe("計画を修正")
      expect(body.revision.reason).toBe("優先度の見直し")
    })

    it("summaryが空の場合は400を返す", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)

      const res = await app.request(`/study-plans/${plan.id}/revisions`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ summary: "" }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe("PATCH /study-plans/:planId/revisions/:revisionId - 変遷更新", () => {
    it("変遷記録のreasonを更新できる", async () => {
      const plan = await createTestPlan(app, ctx.testData.userId)
      const addRes = await app.request(`/study-plans/${plan.id}/revisions`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ summary: "テスト変遷" }),
      })
      const addBody = await parseJson(addRes, revisionResponseSchema)

      const res = await app.request(`/study-plans/${plan.id}/revisions/${addBody.revision.id}`, {
        method: "PATCH",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ reason: "理由を追記" }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, revisionResponseSchema)
      expect(body.revision.reason).toBe("理由を追記")
    })
  })

  describe("認証エラー", () => {
    it("本番環境で認証なしの場合は401を返す", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = studyPlanRoutes({ db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/study-plans", routes)

      const res = await prodApp.request("/study-plans", {
        headers: { "Content-Type": "application/json" },
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("認証が必要です")
    })
  })
})
