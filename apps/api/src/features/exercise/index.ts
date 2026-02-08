import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { exerciseRoutes } from "./route"

export const createExerciseFeature = (env: Env, db: Db) => {
  return exerciseRoutes({ env, db })
}

export type ExerciseRoutes = ReturnType<typeof createExerciseFeature>
