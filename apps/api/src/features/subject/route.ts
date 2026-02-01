import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { createSubjectRequestSchema, updateSubjectRequestSchema, updateTreeRequestSchema, csvImportRequestSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createSubjectRepository } from "./repository"
import {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
} from "./usecase"
import { getSubjectTree, updateSubjectTree } from "./tree"
import { importCSV } from "./csv-import"
import type { SimpleTransactionRunner } from "../../shared/lib/transaction"

type SubjectDeps = {
  env: Env
  db: Db
  txRunner?: SimpleTransactionRunner
}

export const subjectRoutes = ({ db, txRunner }: SubjectDeps) => {
  const subjectRepo = createSubjectRepository(db)
  const deps = { subjectRepo }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // List subjects by study domain
    .get("/study-domains/:domainId/subjects", authMiddleware, async (c) => {
      const user = c.get("user")
      const domainId = c.req.param("domainId")
      const result = await listSubjects(deps, user.id, domainId)

      if (!result.ok) {
        return c.json({ error: "学習領域が見つかりません" }, 404)
      }

      return c.json({ subjects: result.value })
    })

    // Get subject by ID
    .get("/subjects/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await getSubject(deps, user.id, id)

      if (!result.ok) {
        return c.json({ error: "科目が見つかりません" }, 404)
      }

      return c.json({ subject: result.value })
    })

    // Create subject under a study domain
    .post(
      "/study-domains/:domainId/subjects",
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
          return c.json({ error: "学習領域が見つかりません" }, 404)
        }

        // Get the created subject to return full data
        const subjectResult = await getSubject(deps, user.id, result.value.id)
        if (!subjectResult.ok) {
          return c.json({ error: "科目の作成後の取得に失敗しました" }, 500)
        }

        return c.json({ subject: subjectResult.value }, 201)
      }
    )

    // Update subject
    .patch(
      "/subjects/:id",
      authMiddleware,
      zValidator("json", updateSubjectRequestSchema),
      async (c) => {
        const user = c.get("user")
        const id = c.req.param("id")
        const data = c.req.valid("json")
        const result = await updateSubject(deps, user.id, id, data)

        if (!result.ok) {
          return c.json({ error: "科目が見つかりません" }, 404)
        }

        return c.json({ subject: result.value })
      }
    )

    // Delete subject (soft delete)
    .delete("/subjects/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await deleteSubject(deps, user.id, id)

      if (!result.ok) {
        if (result.error === "NOT_FOUND") {
          return c.json({ error: "科目が見つかりません" }, 404)
        }
        // HAS_CATEGORIES
        return c.json({ error: "単元が紐づいているため削除できません" }, 409)
      }

      return c.json({ success: true })
    })

    // Get subject tree
    .get("/subjects/:id/tree", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await getSubjectTree(db, user.id, id)

      if (!result.ok) {
        return c.json({ error: "科目が見つかりません" }, 404)
      }

      return c.json({ tree: result.value })
    })

    // Update subject tree
    .put(
      "/subjects/:id/tree",
      authMiddleware,
      zValidator("json", updateTreeRequestSchema),
      async (c) => {
        const user = c.get("user")
        const id = c.req.param("id")
        const data = c.req.valid("json")
        const result = await updateSubjectTree(db, user.id, id, data, txRunner)

        if (!result.ok) {
          if (result.error === "NOT_FOUND") {
            return c.json({ error: "科目が見つかりません" }, 404)
          }
          // INVALID_ID
          return c.json({ error: "不正なIDが含まれています" }, 400)
        }

        // Return updated tree
        const treeResult = await getSubjectTree(db, user.id, id)
        if (!treeResult.ok) {
          return c.json({ error: "ツリーの取得に失敗しました" }, 500)
        }

        return c.json({ tree: treeResult.value })
      }
    )

    // Import CSV data
    .post(
      "/subjects/:id/import",
      authMiddleware,
      zValidator("json", csvImportRequestSchema),
      async (c) => {
        const user = c.get("user")
        const id = c.req.param("id")
        const { csvContent } = c.req.valid("json")

        const result = await importCSV(db, user.id, id, csvContent, txRunner)

        if (!result.ok) {
          return c.json({ error: "科目が見つかりません" }, 404)
        }

        return c.json(result.value)
      }
    )

  return app
}
