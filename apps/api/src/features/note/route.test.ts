/// <reference types="@cloudflare/workers-types" />
/**
 * Note Routes の統合テスト
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { Hono } from "hono"
import { z } from "zod"
import type { Env, Variables } from "../../shared/types/env"
import { noteRoutes } from "./route"
import {
  setupTestContext,
  createAuthHeaders,
  createAdditionalTestData,
  createNoteTestData,
  parseJson,
  errorResponseSchema,
  type TestContext,
} from "../../test/helpers"
import { createMockAIAdapter, mockAIPresets } from "../../test/mocks/ai"

// レスポンススキーマ定義
const noteSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  sessionId: z.string().nullable(),
  userId: z.string(),
  userMemo: z.string().nullable(),
  keyPoints: z.array(z.string()).nullable(),
  stumbledPoints: z.array(z.string()).nullable(),
  topicName: z.string().optional(),
  subjectName: z.string().optional(),
  categoryId: z.string().optional(),
  subjectId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const noteResponseSchema = z.object({
  note: noteSchema,
})

const notesListSchema = z.object({
  notes: z.array(
    z.object({
      id: z.string(),
      topicId: z.string(),
      userId: z.string(),
      topicName: z.string().optional(),
      subjectName: z.string().optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
  ),
})

// AI Adapterをモック
vi.mock("../../shared/lib/ai", () => ({
  createAIAdapter: () => mockAIPresets.noteSummary,
}))

describe("Note Routes", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let additionalData: ReturnType<typeof createAdditionalTestData>

  beforeEach(() => {
    ctx = setupTestContext()
    additionalData = createAdditionalTestData(ctx.db, ctx.testData)

    // ルートを作成
    const routes = noteRoutes({ env: ctx.env, db: ctx.db as any })

    // メインアプリにマウント（環境変数を初期化）
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, ctx.env)
      await next()
    })
    app.route("/notes", routes)
  })

  describe("POST /notes - ノート作成（セッションから）", () => {
    it("チャットセッションからノートを作成できる", async () => {
      const res = await app.request("/notes", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ sessionId: additionalData.sessionId }),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, noteResponseSchema)
      expect(body.note).toBeDefined()
      expect(body.note.topicId).toBe(ctx.testData.topicId)
      expect(body.note.sessionId).toBe(additionalData.sessionId)
      expect(body.note.userId).toBe(ctx.testData.userId)
    })

    it("存在しないセッションは404を返す", async () => {
      const res = await app.request("/notes", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ sessionId: "non-existent-session" }),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Session not found")
    })

    it("他ユーザーのセッションからノートを作成しようとすると403を返す", async () => {
      const res = await app.request("/notes", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ sessionId: additionalData.otherSessionId }),
      })

      expect(res.status).toBe(403)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Unauthorized")
    })

    it("sessionIdが必須", async () => {
      const res = await app.request("/notes", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })
  })

  describe("GET /notes - ノート一覧", () => {
    it("ユーザーのノート一覧を取得できる", async () => {
      // テストノートを作成
      createNoteTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)
      createNoteTestData(ctx.db, ctx.testData.userId, additionalData.topic2Id)

      const res = await app.request("/notes", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, notesListSchema)
      expect(body.notes).toBeDefined()
      expect(Array.isArray(body.notes)).toBe(true)
      expect(body.notes.length).toBe(2)

      // ノートにtopicName, subjectNameが含まれることを確認
      expect(body.notes[0].topicName).toBeDefined()
      expect(body.notes[0].subjectName).toBeDefined()
    })

    it("ノートがない場合は空配列を返す", async () => {
      const res = await app.request("/notes", {
        headers: createAuthHeaders(additionalData.otherUserId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, notesListSchema)
      expect(body.notes).toEqual([])
    })

    it("他ユーザーのノートは取得できない", async () => {
      createNoteTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)
      createNoteTestData(ctx.db, additionalData.otherUserId, ctx.testData.topicId)

      const res = await app.request("/notes", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, notesListSchema)
      expect(body.notes.length).toBe(1)
      expect(body.notes[0].userId).toBe(ctx.testData.userId)
    })
  })

  describe("GET /notes/topic/:topicId - 論点別ノート一覧", () => {
    it("特定の論点のノート一覧を取得できる", async () => {
      createNoteTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)
      createNoteTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId) // 同じ論点に2つ
      createNoteTestData(ctx.db, ctx.testData.userId, additionalData.topic2Id)

      const res = await app.request(`/notes/topic/${ctx.testData.topicId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, notesListSchema)
      expect(body.notes).toBeDefined()
      expect(body.notes.length).toBe(2)
      body.notes.forEach((note: { topicId: string }) => {
        expect(note.topicId).toBe(ctx.testData.topicId)
      })
    })

    it("該当するノートがない場合は空配列を返す", async () => {
      const res = await app.request(`/notes/topic/${ctx.testData.topicId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, notesListSchema)
      expect(body.notes).toEqual([])
    })
  })

  describe("GET /notes/:noteId - ノート詳細", () => {
    it("ノート詳細を取得できる", async () => {
      const { noteId } = createNoteTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)

      const res = await app.request(`/notes/${noteId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, noteResponseSchema)
      expect(body.note).toBeDefined()
      expect(body.note.id).toBe(noteId)
      expect(body.note.topicName).toBeDefined()
      expect(body.note.subjectName).toBeDefined()
      expect(body.note.categoryId).toBeDefined()
      expect(body.note.subjectId).toBeDefined()
    })

    it("存在しないノートは404を返す", async () => {
      const res = await app.request("/notes/non-existent-note", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Note not found")
    })

    it("他ユーザーのノートにアクセスすると403を返す", async () => {
      const { noteId } = createNoteTestData(ctx.db, additionalData.otherUserId, ctx.testData.topicId)

      const res = await app.request(`/notes/${noteId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(403)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Unauthorized")
    })
  })

  describe("PUT /notes/:noteId - ノート更新", () => {
    it("ノートを更新できる", async () => {
      const { noteId } = createNoteTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)

      const res = await app.request(`/notes/${noteId}`, {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          userMemo: "更新されたメモ",
          keyPoints: ["新しいポイント1", "新しいポイント2"],
        }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, noteResponseSchema)
      expect(body.note).toBeDefined()
      expect(body.note.userMemo).toBe("更新されたメモ")
      expect(body.note.keyPoints).toEqual(["新しいポイント1", "新しいポイント2"])
    })

    it("stumbledPointsを更新できる", async () => {
      const { noteId } = createNoteTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)

      const res = await app.request(`/notes/${noteId}`, {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          stumbledPoints: ["つまずきA", "つまずきB"],
        }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, noteResponseSchema)
      expect(body.note.stumbledPoints).toEqual(["つまずきA", "つまずきB"])
    })

    it("存在しないノートは404を返す", async () => {
      const res = await app.request("/notes/non-existent-note", {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ userMemo: "test" }),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Note not found")
    })

    it("他ユーザーのノートを更新しようとすると403を返す", async () => {
      const { noteId } = createNoteTestData(ctx.db, additionalData.otherUserId, ctx.testData.topicId)

      const res = await app.request(`/notes/${noteId}`, {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ userMemo: "test" }),
      })

      expect(res.status).toBe(403)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Unauthorized")
    })

    it("空のボディでも更新可能", async () => {
      const { noteId } = createNoteTestData(ctx.db, ctx.testData.userId, ctx.testData.topicId)

      const res = await app.request(`/notes/${noteId}`, {
        method: "PUT",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, noteResponseSchema)
      expect(body.note).toBeDefined()
    })
  })

  describe("認証エラー", () => {
    // ローカル環境ではデフォルトユーザーが使用されるため、
    // 本番環境の認証テストは別途必要
    // ここでは環境変数をproductionに変えてテストする例を示す

    it("本番環境で認証なしの場合は401を返す（GET /notes）", async () => {
      // 本番環境の設定を使用
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = noteRoutes({ env: prodEnv, db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/notes", routes)

      const res = await prodApp.request("/notes", {
        headers: { "Content-Type": "application/json" },
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Unauthorized")
    })

    it("本番環境で認証なしの場合は401を返す（POST /notes）", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = noteRoutes({ env: prodEnv, db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/notes", routes)

      const res = await prodApp.request("/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "some-session-id" }),
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Unauthorized")
    })

    it("本番環境で認証なしの場合は401を返す（PUT /notes/:noteId）", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = noteRoutes({ env: prodEnv, db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/notes", routes)

      const res = await prodApp.request("/notes/some-note-id", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMemo: "test" }),
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("Unauthorized")
    })
  })
})
