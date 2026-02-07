import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { suggestPlanItemsRequestSchema, studyPlanParamsSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAIAdapter, streamToSSE, resolveAIConfig } from "@/shared/lib/ai"
import { createStudyPlanRepository } from "./repository"
import { createSubjectRepository } from "../subject/repository"
import { suggestPlanItems } from "./ai-usecase"

type PlanAIRouteDeps = {
  env: Env
  db: Db
}

export const studyPlanAIRoutes = ({ env, db }: PlanAIRouteDeps) => {
  const repo = createStudyPlanRepository(db)
  const subjectRepo = createSubjectRepository(db)
  const aiConfig = resolveAIConfig(env.ENVIRONMENT)
  const aiAdapter = createAIAdapter({
    provider: env.AI_PROVIDER,
    apiKey: env.OPENROUTER_API_KEY,
  })

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    .post(
      "/:planId/suggest",
      authMiddleware,
      zValidator("param", studyPlanParamsSchema),
      zValidator("json", suggestPlanItemsRequestSchema),
      async (c) => {
        const user = c.get("user")
        const { planId } = c.req.valid("param")
        const { prompt } = c.req.valid("json")

        const stream = suggestPlanItems(
          { repo, subjectRepo, aiAdapter, aiConfig },
          { planId, userId: user.id, prompt }
        )

        return streamToSSE(c, stream)
      }
    )

  return app
}
