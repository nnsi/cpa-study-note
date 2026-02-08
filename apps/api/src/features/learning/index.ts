import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { learningRoutes } from "./route"

export const createLearningFeature = (_env: Env, db: Db) => {
  return learningRoutes({ db })
}

export type LearningRoutes = ReturnType<typeof createLearningFeature>
