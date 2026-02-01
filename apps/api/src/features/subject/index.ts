import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { subjectRoutes } from "./route"

export const createSubjectFeature = (env: Env, db: Db) => {
  return subjectRoutes({ env, db })
}

export type SubjectRoutes = ReturnType<typeof createSubjectFeature>

export { createSubjectRepository, type SubjectRepository, type Subject } from "./repository"
export {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
} from "./usecase"
