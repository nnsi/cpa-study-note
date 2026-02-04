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
  const deps = { learningRepo }
  const subjectDeps = { subjectRepo }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // Touch topic - update lastAccessedAt
    .post("/topics/:topicId/touch", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")

      const result = await touchTopic(deps, user.id, topicId)
      if (!result.ok) return handleResult(c, result)
      return c.json({ progress: result.value })
    })

    // Get progress for a topic
    .get("/topics/:topicId/progress", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")

      const result = await getProgress(deps, user.id, topicId)
      if (!result.ok) return handleResult(c, result)
      return c.json({ progress: result.value })
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

        const result = await updateProgress(deps, user.id, topicId, understood)
        if (!result.ok) return handleResult(c, result)
        return c.json({ progress: result.value })
      }
    )

    // Get check history for a topic
    .get("/topics/:topicId/check-history", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")

      const result = await getCheckHistory(deps, user.id, topicId)
      if (!result.ok) return handleResult(c, result)
      return c.json({ history: result.value })
    })

    // List recent topics
    .get(
      "/topics/recent",
      authMiddleware,
      zValidator("query", recentTopicsQuerySchema),
      async (c) => {
        const user = c.get("user")
        const { limit } = c.req.valid("query")

        const result = await listRecentTopics(deps, user.id, limit)
        if (!result.ok) return handleResult(c, result)
        return c.json({ topics: result.value })
      }
    )

    // List all user progress
    .get("/progress", authMiddleware, async (c) => {
      const user = c.get("user")

      const result = await listUserProgress(deps, user.id)
      if (!result.ok) return handleResult(c, result)
      return c.json({ progress: result.value })
    })

    // Get subject progress stats
    .get("/subjects/progress-stats", authMiddleware, async (c) => {
      const user = c.get("user")

      const result = await getSubjectProgressStats(subjectDeps, user.id)
      if (!result.ok) return handleResult(c, result)
      return c.json({ stats: result.value })
    })

  return app
}
