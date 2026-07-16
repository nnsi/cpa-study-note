import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { tocSuggestRequestSchema } from "@cpa-study/shared/schemas"
import { Hono } from "hono"
import { createAIAdapter, resolveAIConfig, streamToSSE } from "@/shared/lib/ai"
import { authMiddleware } from "@/shared/middleware/auth"
import type { Env, Variables } from "@/shared/types/env"
import { createImageRepository } from "../image/repository"
import { createSubjectRepository } from "../subject/repository"
import { suggestFromToc } from "./usecase"

type TocImportRouteDeps = {
  env: Env
  db: Db
}

export const tocImportRoutes = ({ env, db }: TocImportRouteDeps) => {
  const subjectRepo = createSubjectRepository(db)
  const imageRepo = createImageRepository(db)
  const aiConfig = resolveAIConfig(env.ENVIRONMENT)
  const aiAdapter = createAIAdapter({
    provider: env.AI_PROVIDER,
    apiKey: env.OPENROUTER_API_KEY,
  })

  return new Hono<{ Bindings: Env; Variables: Variables }>().post(
    "/subjects/:subjectId/suggest",
    authMiddleware,
    zValidator("json", tocSuggestRequestSchema),
    async (c) => {
      const user = c.get("user")
      const logger = c.get("logger")
      const tracer = c.get("tracer")
      const subjectId = c.req.param("subjectId")
      const { imageIds } = c.req.valid("json")

      const stream = suggestFromToc(
        {
          subjectRepo,
          imageRepo,
          aiAdapter,
          aiConfig,
          r2: env.R2,
          logger,
          tracer,
        },
        { subjectId, userId: user.id, imageIds }
      )

      return streamToSSE(c, stream)
    }
  )
}
