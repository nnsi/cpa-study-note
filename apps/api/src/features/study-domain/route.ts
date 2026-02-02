import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import {
  createStudyDomainRequestSchema,
  updateStudyDomainRequestSchema,
} from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createStudyDomainRepository } from "./repository"
import {
  listStudyDomains,
  getStudyDomain,
  createStudyDomain,
  updateStudyDomain,
  deleteStudyDomain,
} from "./usecase"
import { createSubjectRepository } from "../subject/repository"
import { bulkImportCSVToStudyDomain } from "../subject/usecase"

type StudyDomainDeps = {
  env: Env
  db: Db
}

export const studyDomainRoutes = ({ db }: StudyDomainDeps) => {
  const repo = createStudyDomainRepository(db)
  const deps = { repo }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // List user's study domains
    .get("/", authMiddleware, async (c) => {
      const user = c.get("user")
      const domains = await listStudyDomains(deps, user.id)
      return c.json({ studyDomains: domains })
    })

    // Get study domain by ID
    .get("/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await getStudyDomain(deps, id, user.id)

      if (!result.ok) {
        return c.json({ error: result.error.message }, 404)
      }

      return c.json({ studyDomain: result.value })
    })

    // Create study domain
    .post(
      "/",
      authMiddleware,
      zValidator("json", createStudyDomainRequestSchema),
      async (c) => {
        const user = c.get("user")
        const data = c.req.valid("json")
        const domain = await createStudyDomain(deps, user.id, data)

        return c.json({ studyDomain: domain }, 201)
      }
    )

    // Update study domain
    .patch(
      "/:id",
      authMiddleware,
      zValidator("json", updateStudyDomainRequestSchema),
      async (c) => {
        const user = c.get("user")
        const id = c.req.param("id")
        const data = c.req.valid("json")
        const result = await updateStudyDomain(deps, id, user.id, data)

        if (!result.ok) {
          return c.json({ error: result.error.message }, 404)
        }

        return c.json({ studyDomain: result.value })
      }
    )

    // Delete study domain (soft delete)
    .delete("/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await deleteStudyDomain(deps, id, user.id)

      if (!result.ok) {
        if (result.error.type === "not_found") {
          return c.json({ error: result.error.message }, 404)
        }
        // cannot_delete
        return c.json({ error: result.error.message }, 409)
      }

      return c.json({ success: true })
    })

    // Bulk import CSV to study domain (creates subjects, categories, topics)
    .post(
      "/:id/import-csv",
      authMiddleware,
      zValidator("json", z.object({ csv: z.string() })),
      async (c) => {
        const user = c.get("user")
        const id = c.req.param("id")
        const { csv } = c.req.valid("json")

        const subjectRepo = createSubjectRepository(db)
        const treeDeps = { subjectRepo, db }
        const result = await bulkImportCSVToStudyDomain(treeDeps, user.id, id, csv)

        if (!result.ok) {
          return c.json({ error: "学習領域が見つかりません" }, 404)
        }

        return c.json(result.value)
      }
    )

  return app
}
