import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import { getDailyMetricsRequestSchema, dateStringSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createMetricsRepository } from "./repository"
import { getDailyMetrics, createSnapshot, getTodayMetrics } from "./usecase"
import { handleResult, handleResultWith } from "@/shared/lib/route-helpers"

type MetricsDeps = {
  env: Env
  db: Db
}

export const metricsRoutes = ({ env, db }: MetricsDeps) => {
  const metricsRepo = createMetricsRepository(db)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // 今日の活動メトリクス取得（リアルタイム、タイムゾーン考慮）
    .get("/today", authMiddleware, async (c) => {
      const user = c.get("user")
      const metrics = await getTodayMetrics({ metricsRepo }, user.id, user.timezone)
      return c.json({ metrics })
    })

    // 日次メトリクス取得（タイムゾーン考慮）
    .get(
      "/daily",
      authMiddleware,
      zValidator("query", getDailyMetricsRequestSchema),
      async (c) => {
        const user = c.get("user")
        const { from, to } = c.req.valid("query")

        const result = await getDailyMetrics({ metricsRepo }, user.id, from, to, user.timezone)

        return handleResultWith(c, result, (metrics) => ({ metrics }))
      }
    )

    // スナップショット作成（当日分）
    .post("/snapshot", authMiddleware, async (c) => {
      const user = c.get("user")

      const result = await createSnapshot({ metricsRepo }, user.id)

      return handleResultWith(c, result, (snapshot) => ({ snapshot }), 201)
    })

    // スナップショット作成（指定日）
    .post(
      "/snapshot/:date",
      authMiddleware,
      zValidator("param", z.object({ date: dateStringSchema })),
      async (c) => {
        const user = c.get("user")
        const { date } = c.req.valid("param")

        const result = await createSnapshot({ metricsRepo }, user.id, date)

        return handleResultWith(c, result, (snapshot) => ({ snapshot }), 201)
      }
    )

  return app
}
