import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { suggestTopicsRequestSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAIAdapter, streamToSSE, resolveAIConfig } from "@/shared/lib/ai"
import { createSubjectRepository } from "../subject/repository"
import { createStudyDomainRepository } from "../study-domain/repository"
import { suggestTopics } from "./usecase"

type TopicGeneratorDeps = {
  env: Env
  db: Db
}

export const topicGeneratorRoutes = ({ env, db }: TopicGeneratorDeps) => {
  const subjectRepo = createSubjectRepository(db)
  const studyDomainRepo = createStudyDomainRepository(db)
  const aiConfig = resolveAIConfig(env.ENVIRONMENT)
  const aiAdapter = createAIAdapter({
    provider: env.AI_PROVIDER,
    apiKey: env.OPENROUTER_API_KEY,
  })

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    .post(
      "/subjects/:subjectId/suggest",
      authMiddleware,
      zValidator("json", suggestTopicsRequestSchema),
      async (c) => {
        const subjectId = c.req.param("subjectId")
        const user = c.get("user")
        const { prompt } = c.req.valid("json")
        const logger = c.get("logger").child({ feature: "topic-generator" })
        const tracer = c.get("tracer")

        const stream = suggestTopics(
          { subjectRepo, studyDomainRepo, aiAdapter, aiConfig, logger, tracer },
          { subjectId, userId: user.id, prompt }
        )

        return streamToSSE(c, stream)
      }
    )

  return app
}
