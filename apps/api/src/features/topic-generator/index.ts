import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { topicGeneratorRoutes } from "./route"

export const createTopicGeneratorFeature = (env: Env, db: Db) => {
  return topicGeneratorRoutes({ env, db })
}

export type TopicGeneratorRoutes = ReturnType<typeof createTopicGeneratorFeature>
