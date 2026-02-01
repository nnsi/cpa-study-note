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
      studyDomainId: "cpa",
      name: "管理会計論",
      displayOrder: 2,
      createdAt: now,
      updatedAt: now,
    }).run()

    ctx.db.insert(schema.categories).values({
      id: "category-2",
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
        categoryId: "category-1",
        name: "棚卸資産",
        description: "棚卸資産の評価と会計処理",
        displayOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "topic-3",
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
      // Note: trailing slash may cause 404, use without
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

    it("should list categories with hierarchy for a subject", async () => {
      const res = await req.get(`/api/subjects/${ctx.testData.subjectId}/categories`)

      expect(res.status).toBe(200)
      const data = categoriesResponseSchema.parse(await res.json())
      expect(data.categories).toBeDefined()
      expect(data.categories.length).toBeGreaterThanOrEqual(1)

      const category = data.categories.find((c: { id: string; name: string }) => c.id === ctx.testData.categoryId)
      expect(category).toBeDefined()
      expect(category!.name).toBe("計算")
    })

    it("should list topics by category", async () => {
      const res = await req.get(
        `/api/subjects/${ctx.testData.subjectId}/categories/${ctx.testData.categoryId}/topics`
      )

      expect(res.status).toBe(200)
      const data = topicsResponseSchema.parse(await res.json())
      expect(data.topics).toBeDefined()
      expect(data.topics.length).toBeGreaterThanOrEqual(1)

      const topic = data.topics.find((t: { id: string; name: string; description: string }) => t.id === ctx.testData.topicId)
      expect(topic).toBeDefined()
      expect(topic!.name).toBe("有価証券")
    })
  })

  describe("Topic Details and Progress", () => {
    it("should get topic with progress", async () => {
      const res = await req.get(
        `/api/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}`
      )

      expect(res.status).toBe(200)
      const data = topicResponseSchema.parse(await res.json())
      expect(data.topic).toBeDefined()
      expect(data.topic.id).toBe(ctx.testData.topicId)
      expect(data.topic.name).toBe("有価証券")
      expect(data.topic.description).toBe("有価証券の評価と会計処理")
      // Note: schema uses "difficulty" not "importance"
    })

    it("should return 404 for non-existent topic", async () => {
      const res = await req.get(
        `/api/subjects/${ctx.testData.subjectId}/topics/non-existent-id`
      )

      expect(res.status).toBe(404)
    })

    it("should update progress to understood", async () => {
      const res = await req.put(
        `/api/subjects/${ctx.testData.subjectId}/topics/${ctx.testData.topicId}/progress`,
        { understood: true }
      )

      expect(res.status).toBe(200)
      const data = progressResponseSchema.parse(await res.json())
      expect(data.progress).toBeDefined()
      // Progress.understood is boolean in the new schema
      expect(data.progress.understood).toBe(true)
    })

    it("should update progress with understood=false", async () => {
      const res = await req.put(
        `/api/subjects/${ctx.testData.subjectId}/topics/topic-2/progress`,
        { understood: false }
      )

      expect(res.status).toBe(200)
      const data = progressResponseSchema.parse(await res.json())
      expect(data.progress).toBeDefined()
      expect(data.progress.understood).toBe(false)
    })

    it("should keep understood state on multiple access", async () => {
      // First update: understood
      await req.put(
        `/api/subjects/${ctx.testData.subjectId}/topics/topic-3/progress`,
        { understood: true }
      )

      // Access again without changing understood
      const res = await req.put(
        `/api/subjects/${ctx.testData.subjectId}/topics/topic-3/progress`,
        {}
      )

      expect(res.status).toBe(200)
      const data = progressResponseSchema.parse(await res.json())
      // understood should remain true
      expect(data.progress.understood).toBe(true)
    })
  })

  describe("Progress Statistics", () => {
    it("should get user progress for all topics", async () => {
      const res = await req.get("/api/subjects/progress/me")

      expect(res.status).toBe(200)
      const data = userProgressResponseSchema.parse(await res.json())
      expect(data.progress).toBeDefined()
      expect(Array.isArray(data.progress)).toBe(true)
    })

    it("should get subject progress statistics", async () => {
      const res = await req.get("/api/subjects/progress/subjects")

      expect(res.status).toBe(200)
      const data = statsResponseSchema.parse(await res.json())
      expect(data.stats).toBeDefined()
    })
  })

  describe("Complete Learning Flow", () => {
    it("should complete a full learning session flow", async () => {
      // Step 1: Get subjects
      const subjectsRes = await req.get("/api/subjects")
      expect(subjectsRes.status).toBe(200)
      const { subjects } = subjectsResponseSchema.parse(await subjectsRes.json())
      expect(subjects.length).toBeGreaterThan(0)

      // Step 2: Select a subject and get categories
      const selectedSubject = subjects[0]
      const categoriesRes = await req.get(`/api/subjects/${selectedSubject.id}/categories`)
      expect(categoriesRes.status).toBe(200)
      const { categories } = categoriesResponseSchema.parse(await categoriesRes.json())
      expect(categories.length).toBeGreaterThan(0)

      // Step 3: Select a category and get topics
      const selectedCategory = categories[0]
      const topicsRes = await req.get(
        `/api/subjects/${selectedSubject.id}/categories/${selectedCategory.id}/topics`
      )
      expect(topicsRes.status).toBe(200)
      const { topics } = topicsResponseSchema.parse(await topicsRes.json())
      expect(topics.length).toBeGreaterThan(0)

      // Step 4: View topic details
      const selectedTopic = topics[0]
      const topicRes = await req.get(
        `/api/subjects/${selectedSubject.id}/topics/${selectedTopic.id}`
      )
      expect(topicRes.status).toBe(200)
      const { topic } = topicResponseSchema.parse(await topicRes.json())
      expect(topic.id).toBe(selectedTopic.id)

      // Step 5: Update progress
      const progressRes = await req.put(
        `/api/subjects/${selectedSubject.id}/topics/${selectedTopic.id}/progress`,
        { understood: true }
      )
      expect(progressRes.status).toBe(200)
      const { progress } = progressResponseSchema.parse(await progressRes.json())
      expect(progress.understood).toBe(true)

      // Step 6: Verify progress in statistics
      const statsRes = await req.get("/api/subjects/progress/me")
      expect(statsRes.status).toBe(200)
      const { progress: allProgress } = userProgressResponseSchema.parse(await statsRes.json())
      const topicProgress = allProgress.find((p: { topicId: string; understood: boolean }) => p.topicId === selectedTopic.id)
      expect(topicProgress).toBeDefined()
      expect(topicProgress!.understood).toBe(true)
    })
  })
})
