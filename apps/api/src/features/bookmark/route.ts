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
import { errorResponse } from "@/shared/lib/route-helpers"

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
      const result = await getBookmarks(deps, user.id)
      if (!result.ok) return errorResponse(c, result.error)
      return c.json({ bookmarks: result.value })
    })

    // ブックマーク追加
    .post("/", authMiddleware, zValidator("json", addBookmarkRequestSchema), async (c) => {
      const user = c.get("user")
      const { targetType, targetId } = c.req.valid("json")

      const result = await addBookmark(deps, user.id, targetType, targetId)

      if (!result.ok) {
        return errorResponse(c, result.error)
      }

      if (result.value.alreadyExists) {
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

        const result = await removeBookmark(deps, user.id, targetType, targetId)

        if (!result.ok) {
          return errorResponse(c, result.error)
        }

        return c.json({ message: "Bookmark removed" }, 200)
      }
    )

  return app
}
