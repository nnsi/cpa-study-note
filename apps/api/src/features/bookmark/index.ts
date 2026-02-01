import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { bookmarkRoutes } from "./route"

export const createBookmarkFeature = (env: Env, db: Db) => {
  return bookmarkRoutes({ env, db })
}

export type BookmarkRoutes = ReturnType<typeof createBookmarkFeature>
