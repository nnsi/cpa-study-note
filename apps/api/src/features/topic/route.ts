import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createTopicRepository } from "./repository"
import {
  listSubjects,
  getSubject,
  listCategoriesHierarchy,
  listTopicsByCategory,
  getTopicWithProgress,
  updateProgress,
  listUserProgress,
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
    .get("/", async (c) => {
      const subjects = await listSubjects(deps)
      return c.json({ subjects })
    })

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
    .get("/:subjectId/categories", async (c) => {
      const subjectId = c.req.param("subjectId")
      const categories = await listCategoriesHierarchy(deps, subjectId)
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

    // ユーザーの全進捗取得
    .get("/progress/me", authMiddleware, async (c) => {
      const user = c.get("user")
      const progress = await listUserProgress(deps, user.id)
      return c.json({ progress })
    })

  return app
}
