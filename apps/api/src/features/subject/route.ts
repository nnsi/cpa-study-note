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
import { handleResult, handleResultWith } from "@/shared/lib/route-helpers"

type SubjectRouteDeps = {
  db: Db
  txRunner?: SimpleTransactionRunner
}

export const subjectRoutes = ({ db, txRunner }: SubjectRouteDeps) => {
  const subjectRepo = createSubjectRepository(db)
  const deps = { subjectRepo }
  const treeDeps = { subjectRepo, db, txRunner }

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
        const studyDomainId = resolveStudyDomainId(explicitStudyDomainId, user)
        const result = await listSubjects(deps, user.id, studyDomainId)
        return handleResultWith(c, result, (subjects) => ({ subjects }))
      }
    )

    // Get subject by ID
    .get("/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await getSubject(deps, user.id, id)
      return handleResultWith(c, result, (subject) => ({ subject }))
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
        const result = await createSubject(deps, user.id, {
          studyDomainId: domainId,
          ...data,
        })

        if (!result.ok) {
          return handleResult(c, result)
        }

        // Get the created subject to return full data
        const subjectResult = await getSubject(deps, user.id, result.value.id)
        return handleResultWith(c, subjectResult, (subject) => ({ subject }), 201)
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
        const result = await updateSubject(deps, user.id, id, data)
        return handleResultWith(c, result, (subject) => ({ subject }))
      }
    )

    // Delete subject (soft delete)
    .delete("/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await deleteSubject(deps, user.id, id)

      if (!result.ok) {
        return handleResult(c, result)
      }

      return c.json({ success: true })
    })

    // Get subject tree
    .get("/:id/tree", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await getSubjectTree(treeDeps, user.id, id)
      return handleResultWith(c, result, (tree) => ({ tree }))
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
        const result = await updateSubjectTree(treeDeps, user.id, id, data)

        if (!result.ok) {
          return handleResult(c, result)
        }

        // Return updated tree
        const treeResult = await getSubjectTree(treeDeps, user.id, id)
        return handleResultWith(c, treeResult, (tree) => ({ tree }))
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

        const result = await importCSVToSubject(treeDeps, user.id, id, csvContent)
        return handleResult(c, result)
      }
    )

  return app
}
