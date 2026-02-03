import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { viewRoutes } from "./route"

export const createViewFeature = (env: Env, db: Db) => {
  return viewRoutes({ env, db })
}

export type ViewRoutes = ReturnType<typeof createViewFeature>
