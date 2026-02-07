import { Hono } from "hono"
import type { Db } from "@cpa-study/db"
import type { Env, Variables } from "@/shared/types/env"
import { studyPlanRoutes } from "./route"
import { studyPlanAIRoutes } from "./ai-route"

export const createStudyPlanFeature = (env: Env, db: Db) => {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    .route("/", studyPlanRoutes({ db }))
    .route("/", studyPlanAIRoutes({ env, db }))

  return app
}

export type StudyPlanRoutes = ReturnType<typeof createStudyPlanFeature>
