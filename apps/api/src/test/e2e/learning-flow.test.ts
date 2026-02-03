/// <reference types="@cloudflare/workers-types" />
/**
 * E2E: 学習フロー
 *
 * テスト対象:
 * - 科目一覧取得 -> カテゴリ選択 -> 論点選択
 * - 論点ページ表示 -> 進捗更新
 * - 進捗統計の正確性確認
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { z } from "zod"
import * as schema from "@cpa-study/db/schema"
import {
  setupTestEnv,
  createTestRequest,
  cleanupTestEnv,
  type TestContext,
} from "./helpers"

// Zod schemas for response validation
const subjectSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const subjectsResponseSchema = z.object({
  subjects: z.array(subjectSchema),
})

const subjectResponseSchema = z.object({
  subject: subjectSchema,
})

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
})

const categoriesResponseSchema = z.object({
  categories: z.array(categorySchema),
})

const topicSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
})

const topicsResponseSchema = z.object({
  topics: z.array(topicSchema),
})

const topicResponseSchema = z.object({
  topic: topicSchema,
})

const progressSchema = z.object({
  topicId: z.string(),
  understood: z.boolean(),
})

const progressResponseSchema = z.object({
  progress: progressSchema,
})

const userProgressResponseSchema = z.object({
  progress: z.array(progressSchema),
})

const statsResponseSchema = z.object({
  stats: z.unknown(),
})

describe("E2E: Learning Flow", () => {
  let ctx: TestContext
  let req: ReturnType<typeof createTestRequest>

  beforeAll(() => {
    ctx = setupTestEnv()
    req = createTestRequest(ctx.app, ctx.env)

    const now = new Date()

    // 追加のテストデータを挿入
    ctx.db.insert(schema.subjects).values({
      id: "subject-2",
      userId: ctx.testData.userId,
      studyDomainId: "cpa",
      name: "管理会計論",
      displayOrder: 2,
      createdAt: now,
      updatedAt: now,
    }).run()

    ctx.db.insert(schema.categories).values({
      id: "category-2",
      userId: ctx.testData.userId,
      subjectId: "subject-1",
      name: "理論",
      depth: 0,
      parentId: null,
      displayOrder: 2,
      createdAt: now,
      updatedAt: now,
    }).run()

    ctx.db.insert(schema.topics).values([
      {
        id: "topic-2",
        userId: ctx.testData.userId,
        categoryId: "category-1",
        name: "棚卸資産",
        description: "棚卸資産の評価と会計処理",
        displayOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "topic-3",
        userId: ctx.testData.userId,
        categoryId: "category-2",
        name: "収益認識",
        description: "収益認識の5ステップモデル",
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]).run()
  })

  afterAll(() => {
    cleanupTestEnv(ctx)
  })

  describe("Subject and Category Navigation", () => {
    it("should list all subjects", async () => {
      const res = await req.get("/api/subjects")

      expect(res.status).toBe(200)
      const data = subjectsResponseSchema.parse(await res.json())
      expect(data.subjects).toBeDefined()
      expect(data.subjects.length).toBeGreaterThanOrEqual(1)

      const subject = data.subjects.find((s: { id: string; name: string }) => s.id === ctx.testData.subjectId)
      expect(subject).toBeDefined()
      expect(subject!.name).toBe("財務会計論")
    })

    it("should get subject details", async () => {
      const res = await req.get(`/api/subjects/${ctx.testData.subjectId}`)

      expect(res.status).toBe(200)
      const data = subjectResponseSchema.parse(await res.json())
      expect(data.subject).toBeDefined()
      expect(data.subject.id).toBe(ctx.testData.subjectId)
      expect(data.subject.name).toBe("財務会計論")
    })

    it("should return 404 for non-existent subject", async () => {
      const res = await req.get("/api/subjects/non-existent-id")

      expect(res.status).toBe(404)
    })

  })
})
