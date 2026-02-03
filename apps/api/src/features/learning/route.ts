import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { errorResponse } from "@/shared/lib/route-helpers"
import { ok, type Result } from "@/shared/lib/result"
import type { AppError } from "@/shared/lib/errors"
import { createLearningRepository } from "./repository"
import { createSubjectRepository, type SubjectRepository } from "../subject/repository"
import {
  touchTopic,
  getProgress,
  updateProgress,
  listUserProgress,
  getCheckHistory,
  listRecentTopics,
} from "./usecase"

// Request schemas
const updateProgressSchema = z.object({
  understood: z.boolean().optional(),
})

const recentTopicsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(10),
})

type LearningDeps = {
  env: Env
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

      const result = await touchTopic({ learningRepo }, user.id, topicId)
      if (!result.ok) return errorResponse(c, result.error)
      return c.json({ progress: result.value })
    })

    // Get progress for a topic
    .get("/topics/:topicId/progress", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")

      const result = await getProgress({ learningRepo }, user.id, topicId)
      if (!result.ok) return errorResponse(c, result.error)
      return c.json({ progress: result.value })
    })

    // Update progress for a topic
    .put(
      "/topics/:topicId/progress",
      authMiddleware,
      zValidator("json", updateProgressSchema),
      async (c) => {
        const topicId = c.req.param("topicId")
        const user = c.get("user")
        const { understood } = c.req.valid("json")

        const result = await updateProgress({ learningRepo }, user.id, topicId, understood)
        if (!result.ok) return errorResponse(c, result.error)
        return c.json({ progress: result.value })
      }
    )

    // Get check history for a topic
    .get("/topics/:topicId/check-history", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")

      const result = await getCheckHistory({ learningRepo }, user.id, topicId)
      if (!result.ok) return errorResponse(c, result.error)
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

        const result = await listRecentTopics({ learningRepo }, user.id, limit)
        if (!result.ok) return errorResponse(c, result.error)
        return c.json({ topics: result.value })
      }
    )

    // List all user progress
    .get("/progress", authMiddleware, async (c) => {
      const user = c.get("user")

      const result = await listUserProgress({ learningRepo }, user.id)
      if (!result.ok) return errorResponse(c, result.error)
      return c.json({ progress: result.value })
    })

    // Get subject progress stats
    .get("/subjects/progress-stats", authMiddleware, async (c) => {
      const user = c.get("user")

      const result = await getSubjectProgressStats(subjectRepo, user.id)
      if (!result.ok) return errorResponse(c, result.error)
      return c.json({ stats: result.value })
    })

  return app
}

// Helper function for subject progress stats (uses subject repository)
type SubjectProgressStats = {
  subjectId: string
  subjectName: string
  totalTopics: number
  understoodTopics: number
}

const getSubjectProgressStats = async (
  subjectRepo: SubjectRepository,
  userId: string
): Promise<Result<SubjectProgressStats[], AppError>> => {
  const [subjects, progressCounts] = await Promise.all([
    subjectRepo.findAllSubjectsForUser(undefined, userId),
    subjectRepo.getProgressCountsBySubject(userId),
  ])

  const subjectIds = subjects.map((s) => s.id)
  const batchStats = await subjectRepo.getBatchSubjectStats(subjectIds, userId)

  const topicCountMap = new Map(batchStats.map((s) => [s.subjectId, s.topicCount]))
  const progressMap = new Map(progressCounts.map((p) => [p.subjectId, p.understoodCount]))

  return ok(
    subjects.map((subject) => ({
      subjectId: subject.id,
      subjectName: subject.name,
      totalTopics: topicCountMap.get(subject.id) ?? 0,
      understoodTopics: progressMap.get(subject.id) ?? 0,
    }))
  )
}
