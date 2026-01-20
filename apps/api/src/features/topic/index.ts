import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { topicRoutes } from "./route"

export const createTopicFeature = (env: Env, db: Db) => {
  return topicRoutes({ env, db })
}

export type TopicRoutes = ReturnType<typeof createTopicFeature>
