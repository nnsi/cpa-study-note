import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { subjectRoutes } from "./route"
import { createNoTransactionRunner } from "@/shared/lib/transaction"

export const createSubjectFeature = (env: Env, db: Db) => {
  // D1 does not support SQL transactions, use NoTransactionRunner
  const txRunner = createNoTransactionRunner(db)
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
} from "./usecase"
