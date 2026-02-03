import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { learningRoutes } from "./route"

export const createLearningFeature = (env: Env, db: Db) => {
  return learningRoutes({ env, db })
}

export type LearningRoutes = ReturnType<typeof createLearningFeature>
