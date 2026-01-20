import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { authRoutes } from "./route"

export const createAuthFeature = (env: Env, db: Db) => {
  return authRoutes({ env, db })
}

export type AuthRoutes = ReturnType<typeof createAuthFeature>
