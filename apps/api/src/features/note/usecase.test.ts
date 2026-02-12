/**
 * Note UseCase のテスト
 */
import { describe, it, expect, vi } from "vitest"
import type { NoteRepository } from "./repository"
import type { ChatRepository } from "../chat/repository"
import type { AIAdapter } from "@/shared/lib/ai"
import { defaultAIConfig } from "@/shared/lib/ai"
import type { SubjectRepository } from "../subject/repository"
import { noopLogger } from "../../test/helpers"
import {
  createNoteFromSession,
  createManualNote,
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
  softDelete: vi.fn().mockResolvedValue(true),
  ...overrides,
})

const createMockChatRepo = (overrides: Partial<ChatRepository> = {}): ChatRepository => {
  const defaults: ChatRepository = {
    createSession: vi.fn().mockResolvedValue(createMockSession()),
    findSessionById: vi.fn().mockResolvedValue(null),
    findSessionsByTopic: vi.fn().mockResolvedValue([]),
    findSessionsWithStatsByTopic: vi.fn().mockResolvedValue([]),
    getSessionMessageCount: vi.fn().mockResolvedValue(0),
    getSessionQualityStats: vi.fn().mockResolvedValue({ goodCount: 0, surfaceCount: 0 }),
    getTopicWithHierarchy: vi.fn().mockResolvedValue(null),
    createMessage: vi.fn().mockResolvedValue(createMockMessage()),
    findMessageById: vi.fn().mockResolvedValue(null),
    findMessagesBySession: vi.fn().mockResolvedValue([]),
    findRecentMessagesForContext: vi.fn().mockResolvedValue([]),
    updateMessageQuality: vi.fn().mockResolvedValue(undefined),
    findGoodQuestionsByTopic: vi.fn().mockResolvedValue([]),
  }
  return { ...defaults, ...overrides }
}

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

const createMockTopic = (overrides = {}) => ({
  id: "topic-1",
  userId: "user-1",
  categoryId: "category-1",
  name: "有価証券",
  description: null,
  difficulty: null,
  topicType: null,
  aiSystemPrompt: null,
  displayOrder: 1,
  createdAt: createMockDate(),
  updatedAt: createMockDate(),
  deletedAt: null,
  ...overrides,
})

const createMockSubjectRepo = (overrides: Partial<SubjectRepository> = {}): SubjectRepository => ({
  findByStudyDomainId: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "new-subject-1" }),
  update: vi.fn().mockResolvedValue(null),
  softDelete: vi.fn().mockResolvedValue(false),
  verifyStudyDomainOwnership: vi.fn().mockResolvedValue(false),
  verifyCategoryBelongsToSubject: vi.fn().mockResolvedValue(false),
  verifyTopicBelongsToSubject: vi.fn().mockResolvedValue(false),
  findSubjectByIdAndUserId: vi.fn().mockResolvedValue(null),
  findCategoriesBySubjectId: vi.fn().mockResolvedValue([]),
  findTopicsByCategoryIds: vi.fn().mockResolvedValue([]),
  findCategoryIdsBySubjectIdWithSoftDeleted: vi.fn().mockResolvedValue([]),
  findTopicIdsBySubjectWithSoftDeleted: vi.fn().mockResolvedValue([]),
  findExistingCategoryIds: vi.fn().mockResolvedValue([]),
  findExistingTopicIds: vi.fn().mockResolvedValue([]),
  softDeleteCategories: vi.fn().mockResolvedValue(undefined),
  softDeleteTopics: vi.fn().mockResolvedValue(undefined),
  upsertCategory: vi.fn().mockResolvedValue(undefined),
  upsertTopic: vi.fn().mockResolvedValue(undefined),
  getProgressCountsByCategory: vi.fn().mockResolvedValue([]),
  getProgressCountsBySubject: vi.fn().mockResolvedValue([]),
  findRecentTopics: vi.fn().mockResolvedValue([]),
  findAllSubjectsForUser: vi.fn().mockResolvedValue([]),
  findSubjectByIdForUser: vi.fn().mockResolvedValue(null),
  getSubjectStats: vi.fn().mockResolvedValue({ categoryCount: 0, topicCount: 0 }),
  getBatchSubjectStats: vi.fn().mockResolvedValue([]),
  findCategoriesHierarchy: vi.fn().mockResolvedValue([]),
  getCategoryTopicCounts: vi.fn().mockResolvedValue([]),
  findTopicsByCategoryIdForUser: vi.fn().mockResolvedValue([]),
  findTopicById: vi.fn().mockResolvedValue(null),
  findTopicWithHierarchy: vi.fn().mockResolvedValue(null),
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
        { noteRepo, chatRepo, aiAdapter, noteSummaryConfig: defaultAIConfig.noteSummary, logger: noopLogger },
        { userId: "user-1", sessionId: "session-1" }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.aiSummary).toBe("テスト要約")
        expect(result.value.keyPoints).toEqual(["ポイント1"])
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
        { noteRepo, chatRepo, aiAdapter, noteSummaryConfig: defaultAIConfig.noteSummary, logger: noopLogger },
        { userId: "user-1", sessionId: "non-existent" }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND")
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
        { noteRepo, chatRepo, aiAdapter, noteSummaryConfig: defaultAIConfig.noteSummary, logger: noopLogger },
        { userId: "user-1", sessionId: "session-1" }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN")
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
        { noteRepo, chatRepo, aiAdapter, noteSummaryConfig: defaultAIConfig.noteSummary, logger: noopLogger },
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
        { noteRepo, chatRepo, aiAdapter, noteSummaryConfig: defaultAIConfig.noteSummary, logger: noopLogger },
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

      const result = await listNotes({ noteRepo, logger: noopLogger }, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(2)
      expect(result.value[0].topicName).toBe("有価証券")
      expect(result.value[0].subjectName).toBe("財務会計論")
      expect(result.value[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it("ノートがない場合は空配列を返す", async () => {
      const noteRepo = createMockNoteRepo({
        findByUser: vi.fn().mockResolvedValue([]),
      })

      const result = await listNotes({ noteRepo, logger: noopLogger }, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toEqual([])
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

      const result = await listNotesByTopic({ noteRepo, logger: noopLogger }, "user-1", "topic-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(2)
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

      const result = await getNote({ noteRepo, logger: noopLogger }, "user-1", "note-1")

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.id).toBe("note-1")
        expect(result.value.topicName).toBe("有価証券")
        expect(result.value.subjectName).toBe("財務会計論")
      }
    })

    it("存在しないノートでエラーを返す", async () => {
      const noteRepo = createMockNoteRepo({
        findByIdWithTopic: vi.fn().mockResolvedValue(null),
      })

      const result = await getNote({ noteRepo, logger: noopLogger }, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND")
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

      const result = await getNote({ noteRepo, logger: noopLogger }, "user-1", "note-1")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN")
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
        { noteRepo, logger: noopLogger },
        "user-1",
        "note-1",
        { userMemo: "新しいメモ" }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.userMemo).toBe("新しいメモ")
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
        { noteRepo, logger: noopLogger },
        "user-1",
        "note-1",
        { keyPoints: ["新ポイント1", "新ポイント2"] }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.keyPoints).toEqual(["新ポイント1", "新ポイント2"])
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
        { noteRepo, logger: noopLogger },
        "user-1",
        "note-1",
        { stumbledPoints: ["新つまずき1"] }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.stumbledPoints).toEqual(["新つまずき1"])
      }
    })

    it("存在しないノートでエラーを返す", async () => {
      const noteRepo = createMockNoteRepo({
        findById: vi.fn().mockResolvedValue(null),
      })

      const result = await updateNote(
        { noteRepo, logger: noopLogger },
        "user-1",
        "non-existent",
        { userMemo: "メモ" }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND")
      }
    })

    it("他ユーザーのノート更新を拒否する", async () => {
      const existingNote = createMockNote({ userId: "other-user" })
      const noteRepo = createMockNoteRepo({
        findById: vi.fn().mockResolvedValue(existingNote),
      })

      const result = await updateNote(
        { noteRepo, logger: noopLogger },
        "user-1",
        "note-1",
        { userMemo: "メモ" }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN")
      }
    })
  })

  describe("createManualNote", () => {
    it("独立ノートを作成する", async () => {
      const topic = createMockTopic()
      const createdNote = createMockNote({
        sessionId: null,
        aiSummary: null,
        userMemo: "手動で作成したノート",
        keyPoints: ["ポイント1", "ポイント2"],
        stumbledPoints: ["つまずき1"],
      })

      const noteRepo = createMockNoteRepo({
        create: vi.fn().mockResolvedValue(createdNote),
      })
      const subjectRepo = createMockSubjectRepo({
        findTopicById: vi.fn().mockResolvedValue(topic),
      })

      const result = await createManualNote(
        { noteRepo, subjectRepo, logger: noopLogger },
        {
          userId: "user-1",
          topicId: "topic-1",
          userMemo: "手動で作成したノート",
          keyPoints: ["ポイント1", "ポイント2"],
          stumbledPoints: ["つまずき1"],
        }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.sessionId).toBeNull()
        expect(result.value.aiSummary).toBeNull()
        expect(result.value.userMemo).toBe("手動で作成したノート")
        expect(result.value.keyPoints).toEqual(["ポイント1", "ポイント2"])
        expect(result.value.stumbledPoints).toEqual(["つまずき1"])
        expect(result.value.source).toBe("manual")
      }
      expect(noteRepo.create).toHaveBeenCalledWith({
        userId: "user-1",
        topicId: "topic-1",
        sessionId: null,
        aiSummary: null,
        userMemo: "手動で作成したノート",
        keyPoints: ["ポイント1", "ポイント2"],
        stumbledPoints: ["つまずき1"],
      })
    })

    it("キーポイントとつまずきポイントが空の場合", async () => {
      const topic = createMockTopic()
      const createdNote = createMockNote({
        sessionId: null,
        aiSummary: null,
        userMemo: "シンプルなノート",
        keyPoints: [],
        stumbledPoints: [],
      })

      const noteRepo = createMockNoteRepo({
        create: vi.fn().mockResolvedValue(createdNote),
      })
      const subjectRepo = createMockSubjectRepo({
        findTopicById: vi.fn().mockResolvedValue(topic),
      })

      const result = await createManualNote(
        { noteRepo, subjectRepo, logger: noopLogger },
        {
          userId: "user-1",
          topicId: "topic-1",
          userMemo: "シンプルなノート",
        }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.keyPoints).toEqual([])
        expect(result.value.stumbledPoints).toEqual([])
      }
    })

    it("存在しないトピックでエラーを返す", async () => {
      const noteRepo = createMockNoteRepo()
      const subjectRepo = createMockSubjectRepo({
        findTopicById: vi.fn().mockResolvedValue(null),
      })

      const result = await createManualNote(
        { noteRepo, subjectRepo, logger: noopLogger },
        {
          userId: "user-1",
          topicId: "non-existent",
          userMemo: "テストノート",
        }
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND")
      }
      expect(noteRepo.create).not.toHaveBeenCalled()
    })

    it("チャットノートとしてsource=chatを返す", async () => {
      const session = createMockSession()
      const messages = [createMockMessage()]
      const createdNote = createMockNote({
        sessionId: "session-1",
        aiSummary: "テスト要約",
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
        { noteRepo, chatRepo, aiAdapter, noteSummaryConfig: defaultAIConfig.noteSummary, logger: noopLogger },
        { userId: "user-1", sessionId: "session-1" }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.source).toBe("chat")
      }
    })
  })

  // === 境界値テスト ===

  describe("createManualNote 境界値", () => {
    it("keyPoints空配列かつstumbledPoints空配列で正常に作成される", async () => {
      const topic = createMockTopic()
      const createdNote = createMockNote({
        sessionId: null,
        aiSummary: null,
        userMemo: "メモのみのノート",
        keyPoints: [],
        stumbledPoints: [],
      })

      const noteRepo = createMockNoteRepo({
        create: vi.fn().mockResolvedValue(createdNote),
      })
      const subjectRepo = createMockSubjectRepo({
        findTopicById: vi.fn().mockResolvedValue(topic),
      })

      const result = await createManualNote(
        { noteRepo, subjectRepo, logger: noopLogger },
        {
          userId: "user-1",
          topicId: "topic-1",
          userMemo: "メモのみのノート",
          keyPoints: [],
          stumbledPoints: [],
        }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.keyPoints).toEqual([])
        expect(result.value.stumbledPoints).toEqual([])
      }
      expect(noteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          keyPoints: [],
          stumbledPoints: [],
        })
      )
    })

    it("keyPointsが1要素のみで正常に作成される", async () => {
      const topic = createMockTopic()
      const createdNote = createMockNote({
        sessionId: null,
        aiSummary: null,
        userMemo: "1ポイントノート",
        keyPoints: ["唯一のポイント"],
        stumbledPoints: [],
      })

      const noteRepo = createMockNoteRepo({
        create: vi.fn().mockResolvedValue(createdNote),
      })
      const subjectRepo = createMockSubjectRepo({
        findTopicById: vi.fn().mockResolvedValue(topic),
      })

      const result = await createManualNote(
        { noteRepo, subjectRepo, logger: noopLogger },
        {
          userId: "user-1",
          topicId: "topic-1",
          userMemo: "1ポイントノート",
          keyPoints: ["唯一のポイント"],
        }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.keyPoints).toEqual(["唯一のポイント"])
      }
      expect(noteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          keyPoints: ["唯一のポイント"],
          stumbledPoints: [],
        })
      )
    })
  })

  describe("createNoteFromSession 境界値", () => {
    it("メッセージが1件のみのセッションで正常にAIサマリー生成される", async () => {
      const session = createMockSession()
      const messages = [
        createMockMessage({ role: "user", content: "たった一つの質問" }),
      ]
      const createdNote = createMockNote({
        aiSummary: "1メッセージの要約",
        keyPoints: ["ポイント1"],
        stumbledPoints: [],
      })

      const noteRepo = createMockNoteRepo({
        create: vi.fn().mockResolvedValue(createdNote),
      })
      const chatRepo = createMockChatRepo({
        findSessionById: vi.fn().mockResolvedValue(session),
        findMessagesBySession: vi.fn().mockResolvedValue(messages),
      })
      const aiAdapter = createMockAIAdapter({
        generateText: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            summary: "1メッセージの要約",
            keyPoints: ["ポイント1"],
            stumbledPoints: [],
          }),
        }),
      })

      const result = await createNoteFromSession(
        { noteRepo, chatRepo, aiAdapter, noteSummaryConfig: defaultAIConfig.noteSummary, logger: noopLogger },
        { userId: "user-1", sessionId: "session-1" }
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.aiSummary).toBe("1メッセージの要約")
      }
      expect(aiAdapter.generateText).toHaveBeenCalled()
      const callArgs = (aiAdapter.generateText as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain("たった一つの質問")
    })
  })
})
