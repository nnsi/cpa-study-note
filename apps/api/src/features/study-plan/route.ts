import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import {
  createStudyPlanRequestSchema,
  updateStudyPlanRequestSchema,
  createStudyPlanItemRequestSchema,
  updateStudyPlanItemRequestSchema,
  reorderStudyPlanItemsRequestSchema,
  createStudyPlanRevisionRequestSchema,
  studyPlanParamsSchema,
  studyPlanItemParamsSchema,
} from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createStudyPlanRepository } from "./repository"
import {
  listPlans,
  getPlanDetail,
  createPlan,
  updatePlan,
  archivePlan,
  unarchivePlan,
  duplicatePlan,
  addItem,
  updateItem,
  removeItem,
  reorderItems,
  addRevision,
} from "./usecase"
import { handleResult, handleResultWith } from "@/shared/lib/route-helpers"

type StudyPlanRouteDeps = {
  db: Db
}

export const studyPlanRoutes = ({ db }: StudyPlanRouteDeps) => {
  const repo = createStudyPlanRepository(db)
  const deps = { repo }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // 計画一覧
    .get("/", authMiddleware, async (c) => {
      const user = c.get("user")
      const archived = c.req.query("archived")
      const filter = archived !== undefined ? { archived: archived === "true" } : undefined
      const result = await listPlans(deps, user.id, filter)
      return handleResultWith(c, result, (plans) => ({ plans }))
    })

    // 計画作成
    .post("/", authMiddleware, zValidator("json", createStudyPlanRequestSchema), async (c) => {
      const user = c.get("user")
      const input = c.req.valid("json")
      const result = await createPlan(deps, user.id, input)
      return handleResultWith(c, result, (plan) => ({ plan }), 201)
    })

    // 計画詳細
    .get("/:planId", authMiddleware, zValidator("param", studyPlanParamsSchema), async (c) => {
      const user = c.get("user")
      const { planId } = c.req.valid("param")
      const result = await getPlanDetail(deps, user.id, planId)
      return handleResult(c, result)
    })

    // 計画更新
    .patch("/:planId", authMiddleware, zValidator("param", studyPlanParamsSchema), zValidator("json", updateStudyPlanRequestSchema), async (c) => {
      const user = c.get("user")
      const { planId } = c.req.valid("param")
      const input = c.req.valid("json")
      const result = await updatePlan(deps, user.id, planId, input)
      return handleResultWith(c, result, (plan) => ({ plan }))
    })

    // 計画アーカイブ
    .post("/:planId/archive", authMiddleware, zValidator("param", studyPlanParamsSchema), async (c) => {
      const user = c.get("user")
      const { planId } = c.req.valid("param")
      const result = await archivePlan(deps, user.id, planId)
      return handleResult(c, result, 204)
    })

    // 計画アーカイブ解除
    .post("/:planId/unarchive", authMiddleware, zValidator("param", studyPlanParamsSchema), async (c) => {
      const user = c.get("user")
      const { planId } = c.req.valid("param")
      const result = await unarchivePlan(deps, user.id, planId)
      return handleResult(c, result, 204)
    })

    // 計画複製
    .post("/:planId/duplicate", authMiddleware, zValidator("param", studyPlanParamsSchema), async (c) => {
      const user = c.get("user")
      const { planId } = c.req.valid("param")
      const result = await duplicatePlan(deps, user.id, planId)
      return handleResultWith(c, result, (plan) => ({ plan }), 201)
    })

    // 要素並べ替え (PUT must come before /:planId/items/:itemId to avoid conflict)
    .put("/:planId/items/reorder", authMiddleware, zValidator("param", studyPlanParamsSchema), zValidator("json", reorderStudyPlanItemsRequestSchema), async (c) => {
      const user = c.get("user")
      const { planId } = c.req.valid("param")
      const { itemIds } = c.req.valid("json")
      const result = await reorderItems(deps, user.id, planId, itemIds)
      return handleResult(c, result, 204)
    })

    // 要素追加
    .post("/:planId/items", authMiddleware, zValidator("param", studyPlanParamsSchema), zValidator("json", createStudyPlanItemRequestSchema), async (c) => {
      const user = c.get("user")
      const { planId } = c.req.valid("param")
      const input = c.req.valid("json")
      const result = await addItem(deps, user.id, planId, input)
      return handleResultWith(c, result, (item) => ({ item }), 201)
    })

    // 要素更新
    .patch("/:planId/items/:itemId", authMiddleware, zValidator("param", studyPlanItemParamsSchema), zValidator("json", updateStudyPlanItemRequestSchema), async (c) => {
      const user = c.get("user")
      const { planId, itemId } = c.req.valid("param")
      const input = c.req.valid("json")
      const result = await updateItem(deps, user.id, planId, itemId, input)
      return handleResultWith(c, result, (item) => ({ item }))
    })

    // 要素削除
    .delete("/:planId/items/:itemId", authMiddleware, zValidator("param", studyPlanItemParamsSchema), async (c) => {
      const user = c.get("user")
      const { planId, itemId } = c.req.valid("param")
      const result = await removeItem(deps, user.id, planId, itemId)
      return handleResult(c, result, 204)
    })

    // 変遷記録追加
    .post("/:planId/revisions", authMiddleware, zValidator("param", studyPlanParamsSchema), zValidator("json", createStudyPlanRevisionRequestSchema), async (c) => {
      const user = c.get("user")
      const { planId } = c.req.valid("param")
      const input = c.req.valid("json")
      const result = await addRevision(deps, user.id, planId, input)
      return handleResultWith(c, result, (revision) => ({ revision }), 201)
    })

  return app
}
