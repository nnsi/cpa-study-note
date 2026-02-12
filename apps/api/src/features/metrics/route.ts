import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import { getDailyMetricsRequestSchema, dateStringSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createMetricsRepository } from "./repository"
import { getDailyMetrics, createSnapshot, getTodayMetrics } from "./usecase"
import { handleResult } from "@/shared/lib/route-helpers"

type MetricsDeps = {
  db: Db
}

export const metricsRoutes = ({ db }: MetricsDeps) => {
  const metricsRepo = createMetricsRepository(db)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // 今日の活動メトリクス取得（リアルタイム、タイムゾーン考慮）
    .get("/today", authMiddleware, async (c) => {
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "metrics" })
      const result = await getTodayMetrics({ metricsRepo, logger }, user.id, user.timezone)
      return handleResult(c, result, "metrics")
    })

    // 日次メトリクス取得（タイムゾーン考慮）
    .get(
      "/daily",
      authMiddleware,
      zValidator("query", getDailyMetricsRequestSchema),
      async (c) => {
        const user = c.get("user")
        const { from, to } = c.req.valid("query")
        const logger = c.get("logger").child({ feature: "metrics" })

        const result = await getDailyMetrics({ metricsRepo, logger }, user.id, from, to, user.timezone)
        return handleResult(c, result, "metrics")
      }
    )

    // スナップショット作成（当日分）
    .post("/snapshot", authMiddleware, async (c) => {
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "metrics" })

      const result = await createSnapshot({ metricsRepo, logger }, user.id)
      return handleResult(c, result, "snapshot", 201)
    })

    // スナップショット作成（指定日）
    .post(
      "/snapshot/:date",
      authMiddleware,
      zValidator("param", z.object({ date: dateStringSchema })),
      async (c) => {
        const user = c.get("user")
        const { date } = c.req.valid("param")
        const logger = c.get("logger").child({ feature: "metrics" })

        const result = await createSnapshot({ metricsRepo, logger }, user.id, date)
        return handleResult(c, result, "snapshot", 201)
      }
    )

  return app
}
