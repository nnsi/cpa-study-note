import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { studyDomainRoutes } from "./route"

export const createStudyDomainFeature = (env: Env, db: Db) => {
  return studyDomainRoutes({ env, db })
}

export type StudyDomainRoutes = ReturnType<typeof createStudyDomainFeature>
