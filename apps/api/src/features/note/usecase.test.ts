/**
 * Note UseCase のテスト
 */
import { describe, it, expect, vi } from "vitest"
import type { NoteRepository } from "./repository"
import type { ChatRepository } from "../chat/repository"
import type { AIAdapter } from "@/shared/lib/ai"
import {
  createNoteFromSession,
  listNotes,
  listNotesByTopic,
  getNote,
  updateNote,
} from "./usecase"

// テストデータ生成ヘルパー
const createMockDate = (offset = 0) => new Date(Date.now() + offset)

const createMockNote = (overrides = {}) => ({
  id: "note-1",
  userId: "user-1",
  topicId: "topic-1",
  sessionId: "session-1",
  aiSummary: "AIによる要約",
  userMemo: null,
  keyPoints: ["重要ポイント1", "重要ポイント2"],
  stumbledPoints: ["つまずきポイント1"],
  createdAt: createMockDate(),
  updatedAt: createMockDate(),
  ...overrides,
})

const createMockSession = (overrides = {}) => ({
  id: "session-1",
  userId: "user-1",
  topicId: "topic-1",
  createdAt: createMockDate(),
  updatedAt: createMockDate(),
  ...overrides,
})

const createMockMessage = (overrides = {}) => ({
  id: "message-1",
  sessionId: "session-1",
  role: "user",
  content: "有価証券の評価について教えてください",
  imageId: null,
  ocrResult: null,
  questionQuality: null,
  createdAt: createMockDate(),
  ...overrides,
})

// モックリポジトリファクトリ
const createMockNoteRepo = (overrides: Partial<NoteRepository> = {}): NoteRepository => ({
  create: vi.fn().mockResolvedValue(createMockNote()),
  findById: vi.fn().mockResolvedValue(null),
  findByIdWithTopic: vi.fn().mockResolvedValue(null),
  findBySessionId: vi.fn().mockResolvedValue(null),
  findByTopic: vi.fn().mockResolvedValue([]),
  findByUser: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockResolvedValue(null),
  ...overrides,
})

const createMockChatRepo = (overrides: Partial<ChatRepository> = {}): ChatRepository => ({
  createSession: vi.fn().mockResolvedValue(createMockSession()),
  findSessionById: vi.fn().mockResolvedValue(null),
  findSessionsByTopic: vi.fn().mockResolvedValue([]),
  getSessionMessageCount: vi.fn().mockResolvedValue(0),
  getSessionQualityStats: vi.fn().mockResolvedValue({ goodCount: 0, badCount: 0 }),
  createMessage: vi.fn().mockResolvedValue(createMockMessage()),
  findMessageById: vi.fn().mockResolvedValue(null),
  findMessagesBySession: vi.fn().mockResolvedValue([]),
  updateMessageQuality: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

const createMockAIAdapter = (overrides: Partial<AIAdapter> = {}): AIAdapter => ({
  generateText: vi.fn().mockResolvedValue({
    content: JSON.stringify({
      summary: "テスト要約",
      keyPoints: ["ポイント1"],
      stumbledPoints: ["つまずき1"],
    }),
  }),
  streamText: vi.fn(),
  ...overrides,
})

describe("Note UseCase", () => {
  describe("createNoteFromSession", () => {
    it("会話からの要約を生成する", async () => {
      const session = createMockSession()
      const messages = [
        createMockMessage({ role: "user", content: "有価証券の評価について教えてください" }),
        createMockMessage({ role: "assistant", content: "有価証券には複数の評価方法があります..." }),
      ]
      const createdNote = createMockNote({
        aiSummary: "テスト要約",
        keyPoints: ["ポイント1"],
        stumbledPoints: ["つまずき1"],
      })

      const noteRepo = createMockNoteRepo({
        create: vi.fn().mockResolvedValue(createdNote),
      })
      const chatRepo = createMockChatRepo({
        findSessionById: vi.fn().mockResolvedValue(session),
        findMessagesBySession: vi.fn().mockResolvedValue(messages),
      })
      const aiAdapter = createMockAIAdapter()

      const result = await createNoteFromSession(
        { noteRepo, chatRepo, aiAdapter },
        { userId: "user-1", sessionId: "session-1" }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.note.aiSummary).toBe("テスト要約")
        expect(result.note.keyPoints).toEqual(["ポイント1"])
      }
      expect(aiAdapter.generateText).toHaveBeenCalled()
      expect(noteRepo.create).toHaveBeenCalled()
    })

    it("存在しないセッションでエラーを返す", async () => {
      const noteRepo = createMockNoteRepo()
      const chatRepo = createMockChatRepo({
        findSessionById: vi.fn().mockResolvedValue(null),
      })
      const aiAdapter = createMockAIAdapter()

      const result = await createNoteFromSession(
        { noteRepo, chatRepo, aiAdapter },
        { userId: "user-1", sessionId: "non-existent" }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("Session not found")
        expect(result.status).toBe(404)
      }
    })

    it("他ユーザーのセッションでエラーを返す", async () => {
      const session = createMockSession({ userId: "other-user" })
      const noteRepo = createMockNoteRepo()
      const chatRepo = createMockChatRepo({
        findSessionById: vi.fn().mockResolvedValue(session),
      })
      const aiAdapter = createMockAIAdapter()

      const result = await createNoteFromSession(
        { noteRepo, chatRepo, aiAdapter },
        { userId: "user-1", sessionId: "session-1" }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("Unauthorized")
        expect(result.status).toBe(403)
      }
    })

    it("メッセージが空のセッションでも処理を続行する", async () => {
      // セッションは存在するがメッセージが空の場合のテスト
      const session = createMockSession()
      const emptyMessages: ReturnType<typeof createMockMessage>[] = []
      const createdNote = createMockNote({
        aiSummary: "空の会話からの要約",
        keyPoints: [],
        stumbledPoints: [],
      })

      const noteRepo = createMockNoteRepo({
        create: vi.fn().mockResolvedValue(createdNote),
      })
      const chatRepo = createMockChatRepo({
        findSessionById: vi.fn().mockResolvedValue(session),
        findMessagesBySession: vi.fn().mockResolvedValue(emptyMessages),
      })
      const aiAdapter = createMockAIAdapter({
        generateText: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            summary: "空の会話からの要約",
            keyPoints: [],
            stumbledPoints: [],
          }),
        }),
      })

      const result = await createNoteFromSession(
        { noteRepo, chatRepo, aiAdapter },
        { userId: "user-1", sessionId: "session-1" }
      )

      // 現在の実装では空メッセージでもAI呼び出しを行う
      expect(result.ok).toBe(true)
      expect(aiAdapter.generateText).toHaveBeenCalled()
      // AIに渡されるプロンプトに空の会話が含まれることを確認
      const callArgs = (aiAdapter.generateText as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain("チャット履歴:")
    })

    it("AIがJSONを返さない場合はcontentをそのまま要約として使用", async () => {
      const session = createMockSession()
      const messages = [createMockMessage()]
      const createdNote = createMockNote({ aiSummary: "プレーンテキストの要約" })

      const noteRepo = createMockNoteRepo({
        create: vi.fn().mockResolvedValue(createdNote),
      })
      const chatRepo = createMockChatRepo({
        findSessionById: vi.fn().mockResolvedValue(session),
        findMessagesBySession: vi.fn().mockResolvedValue(messages),
      })
      const aiAdapter = createMockAIAdapter({
        generateText: vi.fn().mockResolvedValue({
          content: "プレーンテキストの要約", // JSONではない
        }),
      })

      const result = await createNoteFromSession(
        { noteRepo, chatRepo, aiAdapter },
        { userId: "user-1", sessionId: "session-1" }
      )

      expect(result.ok).toBe(true)
      // noteRepo.createにプレーンテキストが渡されることを確認
      expect(noteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aiSummary: "プレーンテキストの要約",
        })
      )
    })
  })

  describe("listNotes", () => {
    it("ユーザーのノート一覧を取得する", async () => {
      const notes = [
        { ...createMockNote(), topicName: "有価証券", subjectName: "財務会計論" },
        { ...createMockNote({ id: "note-2" }), topicName: "棚卸資産", subjectName: "財務会計論" },
      ]
      const noteRepo = createMockNoteRepo({
        findByUser: vi.fn().mockResolvedValue(notes),
      })

      const result = await listNotes({ noteRepo }, "user-1")

      expect(result).toHaveLength(2)
      expect(result[0].topicName).toBe("有価証券")
      expect(result[0].subjectName).toBe("財務会計論")
      expect(result[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it("ノートがない場合は空配列を返す", async () => {
      const noteRepo = createMockNoteRepo({
        findByUser: vi.fn().mockResolvedValue([]),
      })

      const result = await listNotes({ noteRepo }, "user-1")

      expect(result).toEqual([])
    })
  })

  describe("listNotesByTopic", () => {
    it("論点別ノート一覧を取得する", async () => {
      const notes = [
        createMockNote(),
        createMockNote({ id: "note-2", sessionId: "session-2" }),
      ]
      const noteRepo = createMockNoteRepo({
        findByTopic: vi.fn().mockResolvedValue(notes),
      })

      const result = await listNotesByTopic({ noteRepo }, "user-1", "topic-1")

      expect(result).toHaveLength(2)
      expect(noteRepo.findByTopic).toHaveBeenCalledWith("user-1", "topic-1")
    })
  })

  describe("getNote", () => {
    it("ノート詳細を取得する", async () => {
      const note = {
        ...createMockNote(),
        topicName: "有価証券",
        categoryId: "category-1",
        subjectId: "subject-1",
        subjectName: "財務会計論",
      }
      const noteRepo = createMockNoteRepo({
        findByIdWithTopic: vi.fn().mockResolvedValue(note),
      })

      const result = await getNote({ noteRepo }, "user-1", "note-1")

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.note.id).toBe("note-1")
        expect(result.note.topicName).toBe("有価証券")
        expect(result.note.subjectName).toBe("財務会計論")
      }
    })

    it("存在しないノートでエラーを返す", async () => {
      const noteRepo = createMockNoteRepo({
        findByIdWithTopic: vi.fn().mockResolvedValue(null),
      })

      const result = await getNote({ noteRepo }, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("Note not found")
        expect(result.status).toBe(404)
      }
    })

    it("他ユーザーのノートアクセスを拒否する", async () => {
      const note = {
        ...createMockNote({ userId: "other-user" }),
        topicName: "有価証券",
        categoryId: "category-1",
        subjectId: "subject-1",
        subjectName: "財務会計論",
      }
      const noteRepo = createMockNoteRepo({
        findByIdWithTopic: vi.fn().mockResolvedValue(note),
      })

      const result = await getNote({ noteRepo }, "user-1", "note-1")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("Unauthorized")
        expect(result.status).toBe(403)
      }
    })
  })

  describe("updateNote", () => {
    it("メモを更新する", async () => {
      const existingNote = createMockNote()
      const updatedNote = createMockNote({ userMemo: "新しいメモ" })
      const noteRepo = createMockNoteRepo({
        findById: vi.fn().mockResolvedValue(existingNote),
        update: vi.fn().mockResolvedValue(updatedNote),
      })

      const result = await updateNote(
        { noteRepo },
        "user-1",
        "note-1",
        { userMemo: "新しいメモ" }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.note.userMemo).toBe("新しいメモ")
      }
      expect(noteRepo.update).toHaveBeenCalledWith("note-1", { userMemo: "新しいメモ" })
    })

    it("重要ポイントを更新する", async () => {
      const existingNote = createMockNote()
      const updatedNote = createMockNote({ keyPoints: ["新ポイント1", "新ポイント2"] })
      const noteRepo = createMockNoteRepo({
        findById: vi.fn().mockResolvedValue(existingNote),
        update: vi.fn().mockResolvedValue(updatedNote),
      })

      const result = await updateNote(
        { noteRepo },
        "user-1",
        "note-1",
        { keyPoints: ["新ポイント1", "新ポイント2"] }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.note.keyPoints).toEqual(["新ポイント1", "新ポイント2"])
      }
    })

    it("つまずきポイントを更新する", async () => {
      const existingNote = createMockNote()
      const updatedNote = createMockNote({ stumbledPoints: ["新つまずき1"] })
      const noteRepo = createMockNoteRepo({
        findById: vi.fn().mockResolvedValue(existingNote),
        update: vi.fn().mockResolvedValue(updatedNote),
      })

      const result = await updateNote(
        { noteRepo },
        "user-1",
        "note-1",
        { stumbledPoints: ["新つまずき1"] }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.note.stumbledPoints).toEqual(["新つまずき1"])
      }
    })

    it("存在しないノートでエラーを返す", async () => {
      const noteRepo = createMockNoteRepo({
        findById: vi.fn().mockResolvedValue(null),
      })

      const result = await updateNote(
        { noteRepo },
        "user-1",
        "non-existent",
        { userMemo: "メモ" }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("Note not found")
        expect(result.status).toBe(404)
      }
    })

    it("他ユーザーのノート更新を拒否する", async () => {
      const existingNote = createMockNote({ userId: "other-user" })
      const noteRepo = createMockNoteRepo({
        findById: vi.fn().mockResolvedValue(existingNote),
      })

      const result = await updateNote(
        { noteRepo },
        "user-1",
        "note-1",
        { userMemo: "メモ" }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("Unauthorized")
        expect(result.status).toBe(403)
      }
    })
  })
})
