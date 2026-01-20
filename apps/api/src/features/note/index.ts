import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { noteRoutes } from "./route"

export const createNoteFeature = (env: Env, db: Db) => {
  return noteRoutes({ env, db })
}

export type NoteRoutes = ReturnType<typeof createNoteFeature>
