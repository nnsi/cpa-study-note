import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import {
  addBookmarkRequestSchema,
  deleteBookmarkParamsSchema,
} from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createBookmarkRepository } from "./repository"
import { getBookmarks, addBookmark, removeBookmark } from "./usecase"

type BookmarkDeps = {
  env: Env
  db: Db
}

export const bookmarkRoutes = ({ db }: BookmarkDeps) => {
  const repo = createBookmarkRepository(db)
  const deps = { repo }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // ブックマーク一覧取得
    .get("/", authMiddleware, async (c) => {
      const user = c.get("user")
      const bookmarks = await getBookmarks(deps, user.id)
      return c.json({ bookmarks })
    })

    // ブックマーク追加
    .post("/", authMiddleware, zValidator("json", addBookmarkRequestSchema), async (c) => {
      const user = c.get("user")
      const { targetType, targetId } = c.req.valid("json")

      const result = await addBookmark(deps, user.id, targetType, targetId)

      if (!result.success) {
        return c.json({ error: "Target not found" }, 404)
      }

      if (result.alreadyExists) {
        return c.json({ message: "Already bookmarked" }, 200)
      }

      return c.json({ message: "Bookmark added" }, 201)
    })

    // ブックマーク削除
    .delete(
      "/:targetType/:targetId",
      authMiddleware,
      zValidator("param", deleteBookmarkParamsSchema),
      async (c) => {
        const user = c.get("user")
        const { targetType, targetId } = c.req.valid("param")

        const removed = await removeBookmark(deps, user.id, targetType, targetId)

        if (!removed) {
          return c.json({ error: "Bookmark not found" }, 404)
        }

        return c.json({ message: "Bookmark removed" }, 200)
      }
    )

  return app
}
