import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import {
  createStudyDomainRequestSchema,
  updateStudyDomainRequestSchema,
} from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createStudyDomainRepository } from "./repository"
import {
  listPublicStudyDomains,
  getStudyDomain,
  createStudyDomain,
  updateStudyDomain,
  deleteStudyDomain,
  listUserStudyDomains,
  joinStudyDomain,
  leaveStudyDomain,
} from "./usecase"

type StudyDomainDeps = {
  env: Env
  db: Db
}

export const studyDomainRoutes = ({ db }: StudyDomainDeps) => {
  const repo = createStudyDomainRepository(db)
  const deps = { repo }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // List public study domains
    .get("/", async (c) => {
      const domains = await listPublicStudyDomains(deps)
      return c.json({ studyDomains: domains })
    })

    // Get study domain by ID
    .get("/:id", async (c) => {
      const id = c.req.param("id")
      const result = await getStudyDomain(deps, id)

      if (!result.ok) {
        return c.json({ error: result.error.message }, 404)
      }

      return c.json({ studyDomain: result.value })
    })

    // Create study domain (admin only)
    // TODO: Add admin check middleware
    .post(
      "/",
      authMiddleware,
      zValidator("json", createStudyDomainRequestSchema),
      async (c) => {
        const data = c.req.valid("json")
        const result = await createStudyDomain(deps, data)

        if (!result.ok) {
          if (result.error.type === "already_exists") {
            return c.json({ error: result.error.message }, 409)
          }
          return c.json({ error: result.error.message }, 400)
        }

        return c.json({ studyDomain: result.value }, 201)
      }
    )

    // Update study domain (admin only)
    // TODO: Add admin check middleware
    .patch(
      "/:id",
      authMiddleware,
      zValidator("json", updateStudyDomainRequestSchema),
      async (c) => {
        const id = c.req.param("id")
        const data = c.req.valid("json")
        const result = await updateStudyDomain(deps, id, data)

        if (!result.ok) {
          return c.json({ error: result.error.message }, 404)
        }

        return c.json({ studyDomain: result.value })
      }
    )

    // Delete study domain (admin only)
    // TODO: Add admin check middleware
    .delete("/:id", authMiddleware, async (c) => {
      const id = c.req.param("id")
      const result = await deleteStudyDomain(deps, id)

      if (!result.ok) {
        if (result.error.type === "not_found") {
          return c.json({ error: result.error.message }, 404)
        }
        // cannot_delete
        return c.json({ error: result.error.message }, 409)
      }

      return c.json({ success: true })
    })

  return app
}

// User-specific routes under /api/me/study-domains
export const userStudyDomainRoutes = ({ db }: StudyDomainDeps) => {
  const repo = createStudyDomainRepository(db)
  const deps = { repo }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // List user's joined study domains
    .get("/", authMiddleware, async (c) => {
      const user = c.get("user")
      const userDomains = await listUserStudyDomains(deps, user.id)
      return c.json({ userStudyDomains: userDomains })
    })

    // Join a study domain
    .post("/:id/join", authMiddleware, async (c) => {
      const user = c.get("user")
      const studyDomainId = c.req.param("id")
      const result = await joinStudyDomain(deps, user.id, studyDomainId)

      if (!result.ok) {
        if (result.error.type === "not_found") {
          return c.json({ error: result.error.message }, 404)
        }
        // already_exists
        return c.json({ error: result.error.message }, 409)
      }

      return c.json({ userStudyDomain: result.value }, 201)
    })

    // Leave a study domain
    .delete("/:id/leave", authMiddleware, async (c) => {
      const user = c.get("user")
      const studyDomainId = c.req.param("id")
      const result = await leaveStudyDomain(deps, user.id, studyDomainId)

      if (!result.ok) {
        if (result.error.type === "not_found") {
          return c.json({ error: result.error.message }, 404)
        }
        // not_joined
        return c.json({ error: result.error.message }, 400)
      }

      return c.json({ success: true })
    })

  return app
}
