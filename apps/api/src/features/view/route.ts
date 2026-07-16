import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { reviewListQuerySchema, searchQuerySchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { handleResult } from "@/shared/lib/route-helpers"
import { createTopicViewRepository, tracedTopicViewRepo } from "./repositories/topicViewRepo"
import { createSubjectDashboardViewRepository, tracedSubjectDashboardViewRepo } from "./repositories/subjectDashboardViewRepo"
import { createReviewListViewRepository, tracedReviewListViewRepo } from "./repositories/reviewListViewRepo"
import { createCategoryTopicsViewRepository, tracedCategoryTopicsViewRepo } from "./repositories/categoryTopicsViewRepo"
import { createSearchViewRepository, tracedSearchViewRepo } from "./repositories/searchViewRepo"
import { getTopicView, getSubjectDashboard, getReviewList, getCategoryTopics, searchTopics } from "./usecase"

type ViewDeps = {
  db: Db
}

export const viewRoutes = ({ db }: ViewDeps) => {
  const topicViewRepo = createTopicViewRepository(db)
  const subjectDashboardViewRepo = createSubjectDashboardViewRepository(db)
  const reviewListViewRepo = createReviewListViewRepository(db)
  const categoryTopicsViewRepo = createCategoryTopicsViewRepository(db)
  const searchViewRepo = createSearchViewRepository(db)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // Topic detail view
    .get("/topics/:topicId", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")
      const logger = c.get("logger")
      const tracer = c.get("tracer")

      const deps = {
        topicViewRepo: tracedTopicViewRepo(topicViewRepo, tracer),
        subjectDashboardViewRepo, reviewListViewRepo, categoryTopicsViewRepo, searchViewRepo, logger,
      }
      const result = await getTopicView(deps, user.id, topicId)
      return handleResult(c, result)
    })

    // Subject dashboard
    .get("/subjects/:subjectId/dashboard", authMiddleware, async (c) => {
      const subjectId = c.req.param("subjectId")
      const user = c.get("user")
      const logger = c.get("logger")
      const tracer = c.get("tracer")

      const deps = {
        topicViewRepo, subjectDashboardViewRepo: tracedSubjectDashboardViewRepo(subjectDashboardViewRepo, tracer),
        reviewListViewRepo, categoryTopicsViewRepo, searchViewRepo, logger,
      }
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
        const { understood, daysSince, minSessionCount, minGoodQuestionCount, limit } = c.req.valid("query")
        const logger = c.get("logger")
        const tracer = c.get("tracer")

        const deps = {
          topicViewRepo, subjectDashboardViewRepo,
          reviewListViewRepo: tracedReviewListViewRepo(reviewListViewRepo, tracer),
          categoryTopicsViewRepo, searchViewRepo, logger,
        }
        const result = await getReviewList(deps, user.id, {
          understood,
          daysSince,
          minSessionCount,
          minGoodQuestionCount,
          limit,
        })
        return handleResult(c, result)
      }
    )

    // Category topics list
    .get("/categories/:categoryId/topics", authMiddleware, async (c) => {
      const categoryId = c.req.param("categoryId")
      const user = c.get("user")
      const logger = c.get("logger")
      const tracer = c.get("tracer")

      const deps = {
        topicViewRepo, subjectDashboardViewRepo, reviewListViewRepo,
        categoryTopicsViewRepo: tracedCategoryTopicsViewRepo(categoryTopicsViewRepo, tracer),
        searchViewRepo, logger,
      }
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
        const logger = c.get("logger")
        const tracer = c.get("tracer")

        const deps = {
          topicViewRepo, subjectDashboardViewRepo, reviewListViewRepo, categoryTopicsViewRepo,
          searchViewRepo: tracedSearchViewRepo(searchViewRepo, tracer),
          logger,
        }
        const result = await searchTopics(deps, user.id, q, studyDomainId, limit)
        return handleResult(c, result)
      }
    )

  return app
}
