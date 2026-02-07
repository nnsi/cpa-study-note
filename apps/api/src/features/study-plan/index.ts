import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { studyPlanRoutes } from "./route"

export const createStudyPlanFeature = (_env: Env, db: Db) => {
  return studyPlanRoutes({ db })
}

export type StudyPlanRoutes = ReturnType<typeof createStudyPlanFeature>
