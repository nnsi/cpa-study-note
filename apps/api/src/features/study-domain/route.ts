import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import {
  createStudyDomainRequestSchema,
  updateStudyDomainRequestSchema,
  csvImportRequestSchema,
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
import { bulkImportCSVToStudyDomain } from "../subject/tree-usecase"
import { createNoTransactionRunner } from "@/shared/lib/transaction"
import { handleResult } from "@/shared/lib/route-helpers"
import { internalError } from "@/shared/lib/errors"
import { err } from "@/shared/lib/result"

type StudyDomainDeps = {
  db: Db
}

export const studyDomainRoutes = ({ db }: StudyDomainDeps) => {
  const repo = createStudyDomainRepository(db)
  const deps = { repo }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // List user's study domains
    .get("/", authMiddleware, async (c) => {
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "study-domain" })
      const result = await listStudyDomains({ ...deps, logger }, user.id)
      return handleResult(c, result, "studyDomains")
    })

    // Get study domain by ID
    .get("/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "study-domain" })
      const id = c.req.param("id")
      const result = await getStudyDomain({ ...deps, logger }, id, user.id)
      return handleResult(c, result, "studyDomain")
    })

    // Create study domain
    .post(
      "/",
      authMiddleware,
      zValidator("json", createStudyDomainRequestSchema),
      async (c) => {
        const user = c.get("user")
        const logger = c.get("logger").child({ feature: "study-domain" })
        const data = c.req.valid("json")
        const result = await createStudyDomain({ ...deps, logger }, user.id, data)

        return handleResult(c, result, "studyDomain", 201)
      }
    )

    // Update study domain
    .patch(
      "/:id",
      authMiddleware,
      zValidator("json", updateStudyDomainRequestSchema),
      async (c) => {
        const user = c.get("user")
        const logger = c.get("logger").child({ feature: "study-domain" })
        const id = c.req.param("id")
        const data = c.req.valid("json")
        const result = await updateStudyDomain({ ...deps, logger }, id, user.id, data)
        return handleResult(c, result, "studyDomain")
      }
    )

    // Delete study domain (soft delete)
    .delete("/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "study-domain" })
      const id = c.req.param("id")
      const result = await deleteStudyDomain({ ...deps, logger }, id, user.id)

      return handleResult(c, result, 204)
    })

    // Bulk import 4-column CSV
    .post(
      "/:id/import-csv",
      authMiddleware,
      zValidator("json", csvImportRequestSchema),
      async (c) => {
        const user = c.get("user")
        const id = c.req.param("id")
        const { csvContent } = c.req.valid("json")
        const logger = c.get("logger").child({ feature: "study-domain" })

        try {
          const subjectRepo = createSubjectRepository(db)
          const txRunner = createNoTransactionRunner(db)
          const treeDeps = { subjectRepo, db, txRunner, logger }

          const result = await bulkImportCSVToStudyDomain(treeDeps, user.id, id, csvContent)
          return handleResult(c, result)
        } catch (e) {
          logger.error("CSV import failed", { error: e instanceof Error ? e.message : String(e) })
          return handleResult(c, err(internalError("インポート中にエラーが発生しました")))
        }
      }
    )

  return app
}
