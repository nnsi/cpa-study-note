import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { chatRoutes } from "./route"

export const createChatFeature = (env: Env, db: Db) => {
  return chatRoutes({ env, db })
}

export type ChatRoutes = ReturnType<typeof createChatFeature>
