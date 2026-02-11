import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { quickChatRoutes } from "./route"

export const createQuickChatFeature = (env: Env, db: Db) => {
  return quickChatRoutes({ env, db })
}

export type QuickChatRoutes = ReturnType<typeof createQuickChatFeature>
