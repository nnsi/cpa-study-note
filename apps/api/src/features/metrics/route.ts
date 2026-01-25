import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createMetricsRepository } from "./repository"
import { getDailyMetrics, createSnapshot, getTodayMetrics } from "./usecase"

type MetricsDeps = {
  env: Env
  db: Db
}

export const metricsRoutes = ({ env, db }: MetricsDeps) => {
  const metricsRepo = createMetricsRepository(db)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // 今日の活動メトリクス取得（リアルタイム）
    .get("/today", authMiddleware, async (c) => {
      const user = c.get("user")
      const metrics = await getTodayMetrics({ metricsRepo }, user.id)
      return c.json({ metrics })
    })

    // 日次メトリクス取得
    .get(
      "/daily",
      authMiddleware,
      zValidator(
        "query",
        z.object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
      ),
      async (c) => {
        const user = c.get("user")
        const { from, to } = c.req.valid("query")

        const result = await getDailyMetrics({ metricsRepo }, user.id, from, to)

        if (!result.ok) {
          return c.json({ error: result.error }, result.status as 400)
        }

        return c.json({ metrics: result.metrics })
      }
    )

    // スナップショット作成（当日分）
    .post("/snapshot", authMiddleware, async (c) => {
      const user = c.get("user")

      const result = await createSnapshot({ metricsRepo }, user.id)

      if (!result.ok) {
        return c.json({ error: result.error }, result.status as 400)
      }

      return c.json({ snapshot: result.snapshot }, 201)
    })

    // スナップショット作成（指定日）
    .post(
      "/snapshot/:date",
      authMiddleware,
      zValidator(
        "param",
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
      ),
      async (c) => {
        const user = c.get("user")
        const { date } = c.req.valid("param")

        const result = await createSnapshot({ metricsRepo }, user.id, date)

        if (!result.ok) {
          return c.json({ error: result.error }, result.status as 400)
        }

        return c.json({ snapshot: result.snapshot }, 201)
      }
    )

  return app
}
