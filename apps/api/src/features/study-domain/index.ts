import type { Db } from "@cpa-study/db"
import { studyDomainRoutes } from "./route"

export const createStudyDomainFeature = (db: Db) => {
  return studyDomainRoutes({ db })
}

export type StudyDomainRoutes = ReturnType<typeof createStudyDomainFeature>
