import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import { topicFilterRequestSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "@/shared/middleware/auth"
import { createTopicRepository } from "./repository"
import {
  listSubjects,
  getSubject,
  listCategoriesHierarchy,
  listTopicsByCategory,
  getTopicWithProgress,
  updateProgress,
  listUserProgress,
  getSubjectProgressStats,
  getCheckHistory,
  filterTopics,
  listRecentTopics,
  resolveStudyDomainId,
} from "./usecase"

type TopicDeps = {
  env: Env
  db: Db
}

export const topicRoutes = ({ db }: TopicDeps) => {
  const repo = createTopicRepository(db)
  const deps = { repo }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // 科目一覧
    .get(
      "/",
      optionalAuthMiddleware,
      zValidator(
        "query",
        z.object({
          studyDomainId: z.string().optional(),
        })
      ),
      async (c) => {
        const { studyDomainId: explicitStudyDomainId } = c.req.valid("query")
        const user = c.get("user")
        const studyDomainId = resolveStudyDomainId(explicitStudyDomainId, user)
        const subjects = await listSubjects(deps, studyDomainId)
        return c.json({ subjects })
      }
    )

    // 論点フィルタ（/:subjectId より前に定義）
    .get(
      "/filter",
      authMiddleware,
      zValidator("query", topicFilterRequestSchema),
      async (c) => {
        const user = c.get("user")
        const filters = c.req.valid("query")

        const topics = await filterTopics(deps, user.id, filters)

        return c.json({ topics })
      }
    )

    // 科目詳細
    .get("/:subjectId", async (c) => {
      const subjectId = c.req.param("subjectId")
      const subject = await getSubject(deps, subjectId)

      if (!subject) {
        return c.json({ error: "Subject not found" }, 404)
      }

      return c.json({ subject })
    })

    // カテゴリ一覧（階層構造）
    .get("/:subjectId/categories", optionalAuthMiddleware, async (c) => {
      const subjectId = c.req.param("subjectId")
      const user = c.get("user")
      const categories = await listCategoriesHierarchy(deps, subjectId, user?.id)
      return c.json({ categories })
    })

    // カテゴリの論点一覧
    .get("/:subjectId/categories/:categoryId/topics", async (c) => {
      const categoryId = c.req.param("categoryId")
      const topics = await listTopicsByCategory(deps, categoryId)
      return c.json({ topics })
    })

    // 論点詳細
    .get("/:subjectId/topics/:topicId", authMiddleware, async (c) => {
      const topicId = c.req.param("topicId")
      const user = c.get("user")

      const topic = await getTopicWithProgress(deps, user.id, topicId)

      if (!topic) {
        return c.json({ error: "Topic not found" }, 404)
      }

      return c.json({ topic })
    })

    // 進捗更新
    .put(
      "/:subjectId/topics/:topicId/progress",
      authMiddleware,
      zValidator(
        "json",
        z.object({
          understood: z.boolean().optional(),
        })
      ),
      async (c) => {
        const topicId = c.req.param("topicId")
        const user = c.get("user")
        const body = c.req.valid("json")

        const progress = await updateProgress(
          deps,
          user.id,
          topicId,
          body.understood
        )

        return c.json({ progress })
      }
    )

    // チェック履歴取得
    .get(
      "/:subjectId/topics/:topicId/check-history",
      authMiddleware,
      async (c) => {
        const topicId = c.req.param("topicId")
        const user = c.get("user")

        const history = await getCheckHistory(deps, user.id, topicId)

        return c.json({ history })
      }
    )

    // ユーザーの全進捗取得
    .get("/progress/me", authMiddleware, async (c) => {
      const user = c.get("user")
      const progress = await listUserProgress(deps, user.id)
      return c.json({ progress })
    })

    // 科目別進捗統計
    .get("/progress/subjects", authMiddleware, async (c) => {
      const user = c.get("user")
      const stats = await getSubjectProgressStats(deps, user.id)
      return c.json({ stats })
    })

    // 最近触った論点リスト
    .get("/progress/recent", authMiddleware, async (c) => {
      const user = c.get("user")
      const topics = await listRecentTopics(deps, user.id, 10)
      return c.json({ topics })
    })

  return app
}
