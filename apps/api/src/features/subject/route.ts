import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import {
  createSubjectRequestSchema,
  updateSubjectRequestSchema,
  updateTreeRequestSchema,
  csvImportRequestSchema,
  listSubjectsQuerySchema,
} from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createSubjectRepository } from "./repository"
import {
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  listSubjects,
  resolveStudyDomainId,
} from "./usecase"
import {
  getSubjectTree,
  updateSubjectTree,
  importCSVToSubject,
} from "./tree-usecase"
import type { SimpleTransactionRunner } from "../../shared/lib/transaction"
import { handleResult } from "@/shared/lib/route-helpers"

type SubjectRouteDeps = {
  db: Db
  txRunner?: SimpleTransactionRunner
}

export const subjectRoutes = ({ db, txRunner }: SubjectRouteDeps) => {
  const subjectRepo = createSubjectRepository(db)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // ======== 科目一覧（:id より前に定義） ========

    // 科目一覧
    .get(
      "/",
      authMiddleware,
      zValidator("query", listSubjectsQuerySchema),
      async (c) => {
        const { studyDomainId: explicitStudyDomainId } = c.req.valid("query")
        const user = c.get("user")
        const logger = c.get("logger").child({ feature: "subject" })
        const studyDomainId = resolveStudyDomainId(explicitStudyDomainId, user)
        const result = await listSubjects({ subjectRepo, logger }, user.id, studyDomainId)
        return handleResult(c, result, "subjects")
      }
    )

    // Get subject by ID
    .get("/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const logger = c.get("logger").child({ feature: "subject" })
      const result = await getSubject({ subjectRepo, logger }, user.id, id)
      return handleResult(c, result, "subject")
    })

    // Create subject under a study domain (別プレフィックスなのでそのまま)
    .post(
      "/study-domains/:domainId",
      authMiddleware,
      zValidator("json", createSubjectRequestSchema),
      async (c) => {
        const user = c.get("user")
        const domainId = c.req.param("domainId")
        const data = c.req.valid("json")
        const logger = c.get("logger").child({ feature: "subject" })
        const result = await createSubject({ subjectRepo, logger }, user.id, {
          studyDomainId: domainId,
          ...data,
        })
        return handleResult(c, result, "subject", 201)
      }
    )

    // Update subject
    .patch(
      "/:id",
      authMiddleware,
      zValidator("json", updateSubjectRequestSchema),
      async (c) => {
        const user = c.get("user")
        const id = c.req.param("id")
        const data = c.req.valid("json")
        const logger = c.get("logger").child({ feature: "subject" })
        const result = await updateSubject({ subjectRepo, logger }, user.id, id, data)
        return handleResult(c, result, "subject")
      }
    )

    // Delete subject (soft delete)
    .delete("/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const logger = c.get("logger").child({ feature: "subject" })
      const result = await deleteSubject({ subjectRepo, logger }, user.id, id)
      return handleResult(c, result, 204)
    })

    // Get subject tree
    .get("/:id/tree", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const logger = c.get("logger").child({ feature: "subject" })
      const result = await getSubjectTree({ subjectRepo, db, txRunner, logger }, user.id, id)
      return handleResult(c, result, "tree")
    })

    // Update subject tree
    .put(
      "/:id/tree",
      authMiddleware,
      zValidator("json", updateTreeRequestSchema),
      async (c) => {
        const user = c.get("user")
        const id = c.req.param("id")
        const data = c.req.valid("json")
        const logger = c.get("logger").child({ feature: "subject" })
        const result = await updateSubjectTree({ subjectRepo, db, txRunner, logger }, user.id, id, data)
        return handleResult(c, result, "tree")
      }
    )

    // Import CSV data
    .post(
      "/:id/import",
      authMiddleware,
      zValidator("json", csvImportRequestSchema),
      async (c) => {
        const user = c.get("user")
        const id = c.req.param("id")
        const { csvContent } = c.req.valid("json")
        const logger = c.get("logger").child({ feature: "subject" })

        const result = await importCSVToSubject({ subjectRepo, db, txRunner, logger }, user.id, id, csvContent)
        return handleResult(c, result)
      }
    )

  return app
}
