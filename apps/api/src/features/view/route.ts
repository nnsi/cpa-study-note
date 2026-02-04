import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { reviewListQuerySchema, searchQuerySchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { handleResult } from "@/shared/lib/route-helpers"
import { createTopicViewRepo } from "./repositories/topicViewRepo"
import { createSubjectDashboardViewRepo } from "./repositories/subjectDashboardViewRepo"
import { createReviewListViewRepo } from "./repositories/reviewListViewRepo"
import { createCategoryTopicsViewRepo } from "./repositories/categoryTopicsViewRepo"
import { createSearchViewRepo } from "./repositories/searchViewRepo"
import { getTopicView, getSubjectDashboard, getReviewList, getCategoryTopics, searchTopics } from "./usecase"

type ViewDeps = {
  db: Db
}

export const viewRoutes = ({ db }: ViewDeps) => {
  const topicViewRepo = createTopicViewRepo(db)
  const subjectDashboardViewRepo = createSubjectDashboardViewRepo(db)
  const reviewListViewRepo = createReviewListViewRepo(db)
  const categoryTopicsViewRepo = createCategoryTopicsViewRepo(db)
  const searchViewRepo = createSearchViewRepo(db)

  const deps = {
    topicViewRepo,
    subjectDashboardViewRepo,
    reviewListViewRepo,
    categoryTopicsViewRepo,
    searchViewRepo,
  }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // Topic detail view
    .get("/topics/:topicId", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")

      const result = await getTopicView(deps, user.id, topicId)
      return handleResult(c, result)
    })

    // Subject dashboard
    .get("/subjects/:subjectId/dashboard", authMiddleware, async (c) => {
      const subjectId = c.req.param("subjectId")
      const user = c.get("user")

      const result = await getSubjectDashboard(deps, user.id, subjectId)
      return handleResult(c, result)
    })

    // Review list (topics for review)
    .get(
      "/topics",
      authMiddleware,
      zValidator("query", reviewListQuerySchema),
      async (c) => {
        const user = c.get("user")
        const { understood, daysSince, limit } = c.req.valid("query")

        const result = await getReviewList(deps, user.id, {
          understood,
          daysSince,
          limit,
        })
        return handleResult(c, result)
      }
    )

    // Category topics list
    .get("/categories/:categoryId/topics", authMiddleware, async (c) => {
      const categoryId = c.req.param("categoryId")
      const user = c.get("user")

      const result = await getCategoryTopics(deps, user.id, categoryId)
      return handleResult(c, result)
    })

    // Search topics
    .get(
      "/search",
      authMiddleware,
      zValidator("query", searchQuerySchema),
      async (c) => {
        const user = c.get("user")
        const { q, studyDomainId, limit } = c.req.valid("query")

        const result = await searchTopics(deps, user.id, q, studyDomainId, limit)
        return handleResult(c, result)
      }
    )

  return app
}
