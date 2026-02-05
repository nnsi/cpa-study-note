import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { metricsRoutes } from "./route"

export const createMetricsFeature = (_env: Env, db: Db) => {
  return metricsRoutes({ db })
}

export type MetricsRoutes = ReturnType<typeof createMetricsFeature>
