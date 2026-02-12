import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { quickChatSuggestRequestSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAIAdapter, resolveAIConfig } from "@/shared/lib/ai"
import { createQuickChatRepository } from "./repository"
import { suggestTopicsForChat } from "./usecase"
import { handleResult } from "@/shared/lib/route-helpers"

type QuickChatDeps = {
  env: Env
  db: Db
}

export const quickChatRoutes = ({ env, db }: QuickChatDeps) => {
  const quickChatRepo = createQuickChatRepository(db)
  const aiConfig = resolveAIConfig(env.ENVIRONMENT)
  const aiAdapter = createAIAdapter({
    provider: env.AI_PROVIDER,
    apiKey: env.OPENROUTER_API_KEY,
  })

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    .post(
      "/suggest",
      authMiddleware,
      zValidator("json", quickChatSuggestRequestSchema),
      async (c) => {
        const user = c.get("user")
        const { domainId, question } = c.req.valid("json")
        const logger = c.get("logger").child({ feature: "quick-chat" })

        const result = await suggestTopicsForChat(
          { quickChatRepo, aiAdapter, aiConfig, logger },
          { domainId, userId: user.id, question }
        )

        return handleResult(c, result)
      }
    )

  return app
}
