import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { studyDomainRoutes } from "./route"

export const createStudyDomainFeature = (_env: Env, db: Db) => {
  return studyDomainRoutes({ db })
}

export type StudyDomainRoutes = ReturnType<typeof createStudyDomainFeature>
