import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { studyDomainRoutes, userStudyDomainRoutes } from "./route"

export const createStudyDomainFeature = (env: Env, db: Db) => {
  return studyDomainRoutes({ env, db })
}

export const createUserStudyDomainFeature = (env: Env, db: Db) => {
  return userStudyDomainRoutes({ env, db })
}

export type StudyDomainRoutes = ReturnType<typeof createStudyDomainFeature>
export type UserStudyDomainRoutes = ReturnType<typeof createUserStudyDomainFeature>
