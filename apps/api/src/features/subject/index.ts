import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { subjectRoutes } from "./route"
import { createSimpleTransactionRunner } from "@/shared/lib/transaction"

export const createSubjectFeature = (env: Env, db: Db) => {
  const txRunner = createSimpleTransactionRunner(db)
  return subjectRoutes({ env, db, txRunner })
}

export type SubjectRoutes = ReturnType<typeof createSubjectFeature>

export { createSubjectRepository, type SubjectRepository, type Subject } from "./repository"
export {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectTree,
  updateSubjectTree,
  importCSVToSubject,
  type TreeOperationError,
  type CSVImportError,
} from "./usecase"
