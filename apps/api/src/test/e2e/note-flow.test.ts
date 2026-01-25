/**
 * E2E: ノートフロー
 *
 * テスト対象:
 * - チャット実施 -> ノート作成 -> 要約確認
 * - ノート編集 -> 保存 -> 再取得確認
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import {
  setupTestEnv,
  createTestRequest,
  parseSSEResponse,
  cleanupTestEnv,
  type TestContext,
} from "./helpers"

// Response types for note endpoints
type Note = {
  id: string
  sessionId: string
  topicId: string
  userId: string
  aiSummary: string
  userMemo: string
  keyPoints: string[]
  stumbledPoints: string[]
}

type CreateNoteResponse = {
  note: Note
}

type GetNoteResponse = {
  note: Note
}

type ListNotesResponse = {
  notes: Array<{ id: string; topicId: string }>
}

describe("E2E: Note Flow", () => {
  let ctx: TestContext
  let req: ReturnType<typeof createTestRequest>

  beforeAll(() => {
    ctx = setupTestEnv()
    req = createTestRequest(ctx.app, ctx.env)
  })

  afterAll(() => {
    cleanupTestEnv(ctx)
  })

  describe("Note Creation from Chat Session", () => {
    let sessionId: string
    let noteId: string

    beforeAll(async () => {
      // Create a chat session with messages first
      const res = await req.post(
        `/api/chat/topics/${ctx.testData.topicId}/messages/stream`,
        { content: "有価証券の評価方法について詳しく教えてください" }
      )
      const chunks = await parseSSEResponse(res)
      const sessionChunk = chunks.find((c) => c.type === "session_created")
      sessionId = sessionChunk?.sessionId || ""

      // Add more messages to the session
      await req.post(`/api/chat/sessions/${sessionId}/messages/stream`, {
        content: "売買目的有価証券と満期保有目的有価証券の違いは？",
      })
    }, 30000)

    it("should have a valid chat session", () => {
      expect(sessionId).toBeDefined()
      expect(sessionId.length).toBeGreaterThan(0)
    })

    it("should create note from chat session", async () => {
      const res = await req.post("/api/notes", {
        sessionId,
      })

      expect(res.status).toBe(201)
      const data = await res.json<CreateNoteResponse>()
      expect(data.note).toBeDefined()
      expect(data.note.id).toBeDefined()
      expect(data.note.sessionId).toBe(sessionId)
      expect(data.note.topicId).toBe(ctx.testData.topicId)
      expect(data.note.userId).toBe(ctx.testData.userId)

      // AI summary should be generated
      expect(data.note.aiSummary).toBeDefined()
      expect(data.note.aiSummary.length).toBeGreaterThan(0)

      noteId = data.note.id
    })

    it("should fail to create note from non-existent session", async () => {
      const res = await req.post("/api/notes", {
        sessionId: "non-existent-session",
      })

      expect(res.status).toBe(404)
    })

    it("should get note by ID", async () => {
      expect(noteId).toBeDefined()

      const res = await req.get(`/api/notes/${noteId}`)

      expect(res.status).toBe(200)
      const data = await res.json<GetNoteResponse>()
      expect(data.note).toBeDefined()
      expect(data.note.id).toBe(noteId)
      expect(data.note.aiSummary).toBeDefined()
    })

    it("should return 404 for non-existent note", async () => {
      const res = await req.get("/api/notes/non-existent-id")

      expect(res.status).toBe(404)
    })
  })

  describe("Note Listing", () => {
    beforeAll(async () => {
      // Create additional notes from new sessions
      const res = await req.post(
        `/api/chat/topics/${ctx.testData.topicId}/messages/stream`,
        { content: "連結会計の基本について教えてください" }
      )
      const chunks = await parseSSEResponse(res)
      const sessionChunk = chunks.find((c) => c.type === "session_created")
      const sessionId = sessionChunk?.sessionId

      await req.post("/api/notes", { sessionId })
    }, 15000)

    it("should list all user notes", async () => {
      const res = await req.get("/api/notes")

      expect(res.status).toBe(200)
      const data = await res.json<ListNotesResponse>()
      expect(data.notes).toBeDefined()
      expect(Array.isArray(data.notes)).toBe(true)
      expect(data.notes.length).toBeGreaterThanOrEqual(1)
    })

    it("should list notes by topic", async () => {
      const res = await req.get(`/api/notes/topic/${ctx.testData.topicId}`)

      expect(res.status).toBe(200)
      const data = await res.json<ListNotesResponse>()
      expect(data.notes).toBeDefined()
      expect(Array.isArray(data.notes)).toBe(true)
      expect(data.notes.length).toBeGreaterThanOrEqual(1)

      // All notes should be for the specified topic
      data.notes.forEach((note) => {
        expect(note.topicId).toBe(ctx.testData.topicId)
      })
    })
  })

  describe("Note Editing", () => {
    let noteId: string

    beforeAll(async () => {
      // Create a note first
      const sessionRes = await req.post(
        `/api/chat/topics/${ctx.testData.topicId}/messages/stream`,
        { content: "減損会計について教えてください" }
      )
      const chunks = await parseSSEResponse(sessionRes)
      const sessionChunk = chunks.find((c) => c.type === "session_created")
      const sessionId = sessionChunk?.sessionId

      const noteRes = await req.post("/api/notes", { sessionId })
      const data = await noteRes.json<CreateNoteResponse>()
      noteId = data.note.id
    }, 15000)

    it("should update note with user memo", async () => {
      const res = await req.put(`/api/notes/${noteId}`, {
        userMemo: "減損会計のポイント:\n- 減損の兆候を把握する\n- 減損損失を認識・測定する",
      })

      expect(res.status).toBe(200)
      const data = await res.json<GetNoteResponse>()
      expect(data.note).toBeDefined()
      expect(data.note.userMemo).toContain("減損会計のポイント")
    })

    it("should update note with key points", async () => {
      const res = await req.put(`/api/notes/${noteId}`, {
        keyPoints: [
          "減損の兆候判定",
          "減損損失の認識",
          "減損損失の測定",
          "回収可能価額の算定",
        ],
      })

      expect(res.status).toBe(200)
      const data = await res.json<GetNoteResponse>()
      expect(data.note).toBeDefined()
      expect(data.note.keyPoints).toBeDefined()
    })

    it("should update note with stumbled points", async () => {
      const res = await req.put(`/api/notes/${noteId}`, {
        stumbledPoints: [
          "使用価値の計算方法が難しい",
          "正味売却価額と使用価値の使い分けが不明",
        ],
      })

      expect(res.status).toBe(200)
      const data = await res.json<GetNoteResponse>()
      expect(data.note).toBeDefined()
      expect(data.note.stumbledPoints).toBeDefined()
    })

    it("should update multiple fields at once", async () => {
      const res = await req.put(`/api/notes/${noteId}`, {
        userMemo: "更新されたメモ",
        keyPoints: ["ポイント1", "ポイント2"],
        stumbledPoints: ["つまずきポイント1"],
      })

      expect(res.status).toBe(200)
      const data = await res.json<GetNoteResponse>()
      expect(data.note.userMemo).toBe("更新されたメモ")
      expect(data.note.keyPoints).toBeDefined()
      expect(data.note.stumbledPoints).toBeDefined()
    })

    it("should persist changes after update", async () => {
      // Update the note
      await req.put(`/api/notes/${noteId}`, {
        userMemo: "永続化テスト用のメモ",
      })

      // Re-fetch and verify
      const res = await req.get(`/api/notes/${noteId}`)
      expect(res.status).toBe(200)
      const data = await res.json<GetNoteResponse>()
      expect(data.note.userMemo).toBe("永続化テスト用のメモ")
    })

    it("should return 404 when updating non-existent note", async () => {
      const res = await req.put("/api/notes/non-existent-id", {
        userMemo: "テスト",
      })

      expect(res.status).toBe(404)
    })
  })

  describe("Complete Note Flow", () => {
    it("should complete a full note creation and editing flow", { timeout: 30000 }, async () => {
      // Step 1: Have a chat conversation
      const chatRes = await req.post(
        `/api/chat/topics/${ctx.testData.topicId}/messages/stream`,
        { content: "棚卸資産の評価方法について詳しく教えてください" }
      )
      expect(chatRes.status).toBe(200)

      const chunks = await parseSSEResponse(chatRes)
      const sessionChunk = chunks.find((c) => c.type === "session_created")
      const sessionId = sessionChunk?.sessionId
      expect(sessionId).toBeDefined()

      // Add follow-up question
      await req.post(`/api/chat/sessions/${sessionId}/messages/stream`, {
        content: "先入先出法と移動平均法の違いは？",
      })

      // Step 2: Create note from session
      const noteRes = await req.post("/api/notes", { sessionId })
      expect(noteRes.status).toBe(201)

      const { note } = await noteRes.json<CreateNoteResponse>()
      expect(note.aiSummary).toBeDefined()
      expect(note.aiSummary.length).toBeGreaterThan(0)

      // Step 3: Add user memo
      const memoRes = await req.put(`/api/notes/${note.id}`, {
        userMemo: "棚卸資産の評価方法についての学習メモ\n\n重要な点:\n- 先入先出法の特徴\n- 移動平均法の計算方法",
      })
      expect(memoRes.status).toBe(200)

      // Step 4: Add key points
      const keyPointsRes = await req.put(`/api/notes/${note.id}`, {
        keyPoints: [
          "先入先出法: 先に仕入れたものから先に払い出し",
          "移動平均法: 仕入の都度、平均単価を計算",
          "期末在庫の評価額の違い",
        ],
      })
      expect(keyPointsRes.status).toBe(200)

      // Step 5: Add stumbled points
      const stumbledRes = await req.put(`/api/notes/${note.id}`, {
        stumbledPoints: [
          "移動平均法の計算手順が複雑",
        ],
      })
      expect(stumbledRes.status).toBe(200)

      // Step 6: Verify final note state
      const finalRes = await req.get(`/api/notes/${note.id}`)
      expect(finalRes.status).toBe(200)

      const { note: finalNote } = await finalRes.json<GetNoteResponse>()
      expect(finalNote.aiSummary).toBeDefined()
      expect(finalNote.userMemo).toContain("棚卸資産の評価方法")
      expect(finalNote.keyPoints).toBeDefined()
      expect(finalNote.stumbledPoints).toBeDefined()

      // Step 7: Verify note appears in listing
      const listRes = await req.get("/api/notes")
      expect(listRes.status).toBe(200)

      const { notes } = await listRes.json<ListNotesResponse>()
      expect(notes.some((n) => n.id === note.id)).toBe(true)

      // Step 8: Verify note appears in topic-specific listing
      const topicNotesRes = await req.get(`/api/notes/topic/${ctx.testData.topicId}`)
      expect(topicNotesRes.status).toBe(200)

      const { notes: topicNotes } = await topicNotesRes.json<ListNotesResponse>()
      expect(topicNotes.some((n) => n.id === note.id)).toBe(true)
    })
  })
})
