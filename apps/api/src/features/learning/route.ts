import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import {
  updateProgressRequestSchema,
  recentTopicsQuerySchema,
} from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { handleResult } from "@/shared/lib/route-helpers"
import { createLearningRepository } from "./repository"
import { createSubjectRepository } from "../subject/repository"
import {
  touchTopic,
  getProgress,
  updateProgress,
  listUserProgress,
  getCheckHistory,
  listRecentTopics,
  getSubjectProgressStats,
} from "./usecase"

type LearningDeps = {
  db: Db
}

export const learningRoutes = ({ db }: LearningDeps) => {
  const learningRepo = createLearningRepository(db)
  const subjectRepo = createSubjectRepository(db)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // Touch topic - update lastAccessedAt
    .post("/topics/:topicId/touch", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "learning" })

      const result = await touchTopic({ learningRepo, logger }, user.id, topicId)
      return handleResult(c, result, "progress")
    })

    // Get progress for a topic
    .get("/topics/:topicId/progress", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "learning" })

      const result = await getProgress({ learningRepo, logger }, user.id, topicId)
      return handleResult(c, result, "progress")
    })

    // Update progress for a topic
    .put(
      "/topics/:topicId/progress",
      authMiddleware,
      zValidator("json", updateProgressRequestSchema),
      async (c) => {
        const topicId = c.req.param("topicId")
        const user = c.get("user")
        const { understood } = c.req.valid("json")
        const logger = c.get("logger").child({ feature: "learning" })

        const result = await updateProgress({ learningRepo, logger }, user.id, topicId, understood)
        return handleResult(c, result, "progress")
      }
    )

    // Get check history for a topic
    .get("/topics/:topicId/check-history", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "learning" })

      const result = await getCheckHistory({ learningRepo, logger }, user.id, topicId)
      return handleResult(c, result, "history")
    })

    // List recent topics
    .get(
      "/topics/recent",
      authMiddleware,
      zValidator("query", recentTopicsQuerySchema),
      async (c) => {
        const user = c.get("user")
        const { limit } = c.req.valid("query")
        const logger = c.get("logger").child({ feature: "learning" })

        const result = await listRecentTopics({ learningRepo, logger }, user.id, limit)
        return handleResult(c, result, "topics")
      }
    )

    // List all user progress
    .get("/progress", authMiddleware, async (c) => {
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "learning" })

      const result = await listUserProgress({ learningRepo, logger }, user.id)
      return handleResult(c, result, "progress")
    })

    // Get subject progress stats
    .get("/subjects/progress-stats", authMiddleware, async (c) => {
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "learning" })

      const result = await getSubjectProgressStats({ subjectRepo, logger }, user.id)
      return handleResult(c, result, "stats")
    })

  return app
}
