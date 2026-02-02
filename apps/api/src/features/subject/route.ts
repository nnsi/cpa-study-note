import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import {
  createSubjectRequestSchema,
  updateSubjectRequestSchema,
  updateTreeRequestSchema,
  csvImportRequestSchema,
  topicFilterRequestSchema,
  topicSearchRequestSchema,
} from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createSubjectRepository } from "./repository"
import {
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectTree,
  updateSubjectTree,
  importCSVToSubject,
  listSubjectsWithStats,
  getSubjectWithStats,
  listCategoriesHierarchy,
  listTopicsByCategory,
  getTopicWithProgress,
  updateProgress,
  listUserProgress,
  getCheckHistory,
  getSubjectProgressStats,
  listRecentTopics,
  filterTopics,
  searchTopicsInDomain,
  resolveStudyDomainId,
} from "./usecase"
import type { SimpleTransactionRunner } from "../../shared/lib/transaction"
import { handleResult, handleResultWith } from "@/shared/lib/route-helpers"

type SubjectDeps = {
  env: Env
  db: Db
  txRunner?: SimpleTransactionRunner
}

export const subjectRoutes = ({ db, txRunner }: SubjectDeps) => {
  const subjectRepo = createSubjectRepository(db)
  const deps = { subjectRepo }
  const treeDeps = { subjectRepo, db, txRunner }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // ======== 科目一覧（:id より前に定義） ========

    // 科目一覧（統計情報付き）
    .get(
      "/subjects",
      authMiddleware,
      zValidator("query", z.object({ studyDomainId: z.string().optional() })),
      async (c) => {
        const { studyDomainId: explicitStudyDomainId } = c.req.valid("query")
        const user = c.get("user")
        const studyDomainId = resolveStudyDomainId(explicitStudyDomainId, user)
        const subjects = await listSubjectsWithStats(deps, user.id, studyDomainId)
        return c.json({ subjects })
      }
    )

    // 論点フィルタ
    .get(
      "/subjects/filter",
      authMiddleware,
      zValidator("query", topicFilterRequestSchema),
      async (c) => {
        const user = c.get("user")
        const filters = c.req.valid("query")
        const topics = await filterTopics(deps, user.id, filters)
        return c.json({ topics })
      }
    )

    // 論点検索
    .get(
      "/subjects/search",
      authMiddleware,
      zValidator("query", topicSearchRequestSchema),
      async (c) => {
        const user = c.get("user")
        const { q, limit, studyDomainId: explicitStudyDomainId } = c.req.valid("query")
        const studyDomainId = resolveStudyDomainId(explicitStudyDomainId, user)
        const results = await searchTopicsInDomain(deps, user.id, studyDomainId, q, limit ?? 20)
        return c.json({ results, total: results.length })
      }
    )

    // ユーザーの全進捗取得
    .get("/subjects/progress/me", authMiddleware, async (c) => {
      const user = c.get("user")
      const progress = await listUserProgress(deps, user.id)
      return c.json({ progress })
    })

    // 科目別進捗統計
    .get("/subjects/progress/subjects", authMiddleware, async (c) => {
      const user = c.get("user")
      const stats = await getSubjectProgressStats(deps, user.id)
      return c.json({ stats })
    })

    // 最近触った論点リスト
    .get("/subjects/progress/recent", authMiddleware, async (c) => {
      const user = c.get("user")
      const topics = await listRecentTopics(deps, user.id, 10)
      return c.json({ topics })
    })

    // Get subject by ID
    .get("/subjects/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await getSubject(deps, user.id, id)
      return handleResultWith(c, result, (subject) => ({ subject }))
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
          return handleResult(c, result)
        }

        // Get the created subject to return full data
        const subjectResult = await getSubject(deps, user.id, result.value.id)
        return handleResultWith(c, subjectResult, (subject) => ({ subject }), 201)
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
        return handleResultWith(c, result, (subject) => ({ subject }))
      }
    )

    // Delete subject (soft delete)
    .delete("/subjects/:id", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await deleteSubject(deps, user.id, id)

      if (!result.ok) {
        return handleResult(c, result)
      }

      return c.json({ success: true })
    })

    // Get subject tree
    .get("/subjects/:id/tree", authMiddleware, async (c) => {
      const user = c.get("user")
      const id = c.req.param("id")
      const result = await getSubjectTree(treeDeps, user.id, id)
      return handleResultWith(c, result, (tree) => ({ tree }))
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
      "/subjects/:id/import",
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

    // 科目詳細（統計情報付き）
    .get("/subjects/:subjectId/detail", authMiddleware, async (c) => {
      const subjectId = c.req.param("subjectId")
      const user = c.get("user")
      const subject = await getSubjectWithStats(deps, user.id, subjectId)

      if (!subject) {
        return c.json({ error: "Subject not found" }, 404)
      }

      return c.json({ subject })
    })

    // カテゴリ一覧（階層構造）
    .get("/subjects/:subjectId/categories", authMiddleware, async (c) => {
      const subjectId = c.req.param("subjectId")
      const user = c.get("user")
      const categories = await listCategoriesHierarchy(deps, user.id, subjectId)
      return c.json({ categories })
    })

    // カテゴリの論点一覧
    .get("/subjects/:subjectId/categories/:categoryId/topics", authMiddleware, async (c) => {
      const subjectId = c.req.param("subjectId")
      const categoryId = c.req.param("categoryId")
      const user = c.get("user")

      // 階層整合性を検証: categoryIdがsubjectIdに属しているか
      const belongsToSubject = await subjectRepo.verifyCategoryBelongsToSubject(categoryId, subjectId, user.id)
      if (!belongsToSubject) {
        return c.json({ error: "Category not found in this subject" }, 404)
      }

      const topics = await listTopicsByCategory(deps, user.id, categoryId)
      return c.json({ topics })
    })

    // 論点詳細（進捗含む）
    .get("/subjects/:subjectId/topics/:topicId", authMiddleware, async (c) => {
      const subjectId = c.req.param("subjectId")
      const topicId = c.req.param("topicId")
      const user = c.get("user")

      // 階層整合性を検証: topicIdがsubjectIdに属しているか
      const belongsToSubject = await subjectRepo.verifyTopicBelongsToSubject(topicId, subjectId, user.id)
      if (!belongsToSubject) {
        return c.json({ error: "Topic not found in this subject" }, 404)
      }

      const topic = await getTopicWithProgress(deps, user.id, topicId)

      if (!topic) {
        return c.json({ error: "Topic not found" }, 404)
      }

      return c.json({ topic })
    })

    // 進捗更新
    .put(
      "/subjects/:subjectId/topics/:topicId/progress",
      authMiddleware,
      zValidator("json", z.object({ understood: z.boolean().optional() })),
      async (c) => {
        const subjectId = c.req.param("subjectId")
        const topicId = c.req.param("topicId")
        const user = c.get("user")
        const body = c.req.valid("json")

        // 階層整合性を検証: topicIdがsubjectIdに属しているか
        const belongsToSubject = await subjectRepo.verifyTopicBelongsToSubject(topicId, subjectId, user.id)
        if (!belongsToSubject) {
          return c.json({ error: "Topic not found in this subject" }, 404)
        }

        const progress = await updateProgress(deps, user.id, topicId, body.understood)

        return c.json({ progress })
      }
    )

    // チェック履歴取得
    .get("/subjects/:subjectId/topics/:topicId/check-history", authMiddleware, async (c) => {
      const subjectId = c.req.param("subjectId")
      const topicId = c.req.param("topicId")
      const user = c.get("user")

      // 階層整合性を検証: topicIdがsubjectIdに属しているか
      const belongsToSubject = await subjectRepo.verifyTopicBelongsToSubject(topicId, subjectId, user.id)
      if (!belongsToSubject) {
        return c.json({ error: "Topic not found in this subject" }, 404)
      }

      const history = await getCheckHistory(deps, user.id, topicId)

      return c.json({ history })
    })

  return app
}
