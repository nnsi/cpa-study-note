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
import { handleResult } from "@/shared/lib/route-helpers"

type BookmarkDeps = {
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
      return handleResult(c, result, "bookmarks")
    })

    // ブックマーク追加
    .post("/", authMiddleware, zValidator("json", addBookmarkRequestSchema), async (c) => {
      const user = c.get("user")
      const { targetType, targetId } = c.req.valid("json")

      const result = await addBookmark(deps, user.id, targetType, targetId)
      return handleResult(c, result, "bookmark", 201)
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
        return handleResult(c, result, 204)
      }
    )

  return app
}
