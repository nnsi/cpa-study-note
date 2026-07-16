import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { tocImportRoutes } from "./route"

export const createTocImportFeature = (env: Env, db: Db) => tocImportRoutes({ env, db })

export type TocImportRoutes = ReturnType<typeof createTocImportFeature>
