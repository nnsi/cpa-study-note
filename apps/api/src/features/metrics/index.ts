import type { Db } from "@cpa-study/db"
import { metricsRoutes } from "./route"

export const createMetricsFeature = (db: Db) => {
  return metricsRoutes({ db })
}

export type MetricsRoutes = ReturnType<typeof createMetricsFeature>
