import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { imageRoutes } from "./route"

export const createImageFeature = (env: Env, db: Db) => {
  return imageRoutes({ env, db })
}

export type ImageRoutes = ReturnType<typeof createImageFeature>
