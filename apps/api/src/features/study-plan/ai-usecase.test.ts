/**
 * StudyPlan AI UseCase のテスト
 */
import { describe, it, expect, vi } from "vitest"
import type { StudyPlanRepository, StudyPlan, StudyPlanItem } from "./repository"
import type { SubjectRepository } from "../subject/repository"
import type { AIAdapter, AIConfig } from "@/shared/lib/ai"
import type { StreamChunk } from "@/shared/lib/ai"
import { noopLogger } from "../../test/helpers"
import { suggestPlanItems } from "./ai-usecase"

// テストデータ
const createMockDate = (offset = 0) => new Date(Date.now() + offset)

const createMockPlan = (overrides: Partial<StudyPlan> = {}): StudyPlan => ({
  id: "plan-1",
  userId: "user-1",
  title: "財務会計学習計画",
  intent: "短答式対策",
  scope: "subject",
  subjectId: "subject-1",
  subjectName: "財務会計論",
  createdAt: createMockDate(),
  updatedAt: createMockDate(),
  archivedAt: null,
  ...overrides,
})

const createMockItem = (overrides: Partial<StudyPlanItem> = {}): StudyPlanItem => ({
  id: "item-1",
  studyPlanId: "plan-1",
  topicId: "topic-1",
  topicName: "有価証券",
  description: "有価証券の分類と評価",
  rationale: "基礎的な論点",
  orderIndex: 0,
  createdAt: createMockDate(),
  ...overrides,
})

const createMockRepo = (overrides: Partial<StudyPlanRepository> = {}): StudyPlanRepository => ({
  findPlansByUser: vi.fn().mockResolvedValue([]),
  findPlanById: vi.fn().mockResolvedValue(null),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  archivePlan: vi.fn(),
  unarchivePlan: vi.fn(),
  duplicatePlan: vi.fn(),
  findItemsByPlan: vi.fn().mockResolvedValue([]),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  reorderItems: vi.fn(),
  findItemById: vi.fn(),
  findRevisionsByPlan: vi.fn().mockResolvedValue([]),
  createRevision: vi.fn(),
  updateRevision: vi.fn(),
  isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
  ...overrides,
})

const createMockSubjectRepo = (overrides: Partial<SubjectRepository> = {}): SubjectRepository => ({
  findByStudyDomainId: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
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
  softDeleteCategories: vi.fn(),
  softDeleteTopics: vi.fn(),
  upsertCategory: vi.fn(),
  upsertTopic: vi.fn(),
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

const createMockAIAdapter = (): AIAdapter => ({
  generateText: vi.fn(),
  streamText: vi.fn().mockImplementation(async function* (): AsyncIterable<StreamChunk> {
    yield { type: "text", content: "提案内容です。" }
    yield { type: "text", content: "\n```json\n{\"items\": []}\n```" }
    yield { type: "done" }
  }),
})

const createMockAIConfig = (): AIConfig => ({
  chat: { model: "test-model", temperature: 0.7, maxTokens: 2000 },
  evaluation: { model: "test-model", temperature: 0, maxTokens: 100 },
  noteSummary: { model: "test-model", temperature: 0.3, maxTokens: 1000 },
  ocr: { model: "test-model", temperature: 0, maxTokens: 2000 },
  speechCorrection: { model: "test-model", temperature: 0, maxTokens: 500 },
  topicGenerator: { model: "test-model", temperature: 0.5, maxTokens: 3000 },
  planAssistant: { model: "test-model", temperature: 0.5, maxTokens: 3000 },
  quickChatSuggest: { model: "test-model", temperature: 0, maxTokens: 500 },
})

// AsyncIterableからチャンクを収集するヘルパー
const collectChunks = async (stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> => {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return chunks
}

describe("StudyPlan AI UseCase", () => {
  describe("suggestPlanItems", () => {
    it("計画に基づいてAI提案をストリーミングする", async () => {
      const plan = createMockPlan()
      const items = [createMockItem()]
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        findPlanById: vi.fn().mockResolvedValue(plan),
        findItemsByPlan: vi.fn().mockResolvedValue(items),
      })
      const subjectRepo = createMockSubjectRepo()
      const aiAdapter = createMockAIAdapter()
      const aiConfig = createMockAIConfig()

      const stream = suggestPlanItems(
        { repo, subjectRepo, aiAdapter, aiConfig, logger: noopLogger },
        { planId: "plan-1", userId: "user-1", prompt: "連結会計も追加すべきですか？" }
      )

      const chunks = await collectChunks(stream)

      expect(chunks.length).toBeGreaterThan(0)
      const textChunks = chunks.filter((c) => c.type === "text")
      expect(textChunks.length).toBeGreaterThan(0)

      // doneチャンクがあることを確認
      const doneChunks = chunks.filter((c) => c.type === "done")
      expect(doneChunks).toHaveLength(1)

      // AIが呼ばれたことを確認
      expect(aiAdapter.streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "test-model",
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "system" }),
            expect.objectContaining({ role: "user" }),
          ]),
        })
      )
    })

    it("他ユーザーの計画へのアクセスでエラーチャンクを返す", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })
      const subjectRepo = createMockSubjectRepo()
      const aiAdapter = createMockAIAdapter()
      const aiConfig = createMockAIConfig()

      const stream = suggestPlanItems(
        { repo, subjectRepo, aiAdapter, aiConfig, logger: noopLogger },
        { planId: "plan-1", userId: "other-user", prompt: "テスト" }
      )

      const chunks = await collectChunks(stream)

      expect(chunks).toHaveLength(1)
      expect(chunks[0].type).toBe("error")
      if (chunks[0].type === "error") {
        expect(chunks[0].error).toContain("見つかりません")
      }
    })

    it("計画が見つからない場合にエラーチャンクを返す", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        findPlanById: vi.fn().mockResolvedValue(null),
      })
      const subjectRepo = createMockSubjectRepo()
      const aiAdapter = createMockAIAdapter()
      const aiConfig = createMockAIConfig()

      const stream = suggestPlanItems(
        { repo, subjectRepo, aiAdapter, aiConfig, logger: noopLogger },
        { planId: "non-existent", userId: "user-1", prompt: "テスト" }
      )

      const chunks = await collectChunks(stream)

      expect(chunks).toHaveLength(1)
      expect(chunks[0].type).toBe("error")
    })

    it("AIストリーミングエラーの場合にエラーチャンクを返す", async () => {
      const plan = createMockPlan()
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        findPlanById: vi.fn().mockResolvedValue(plan),
        findItemsByPlan: vi.fn().mockResolvedValue([]),
      })
      const subjectRepo = createMockSubjectRepo()
      const aiAdapter: AIAdapter = {
        generateText: vi.fn(),
        streamText: vi.fn().mockImplementation(async function* () {
          throw new Error("AI service error")
        }),
      }
      const aiConfig = createMockAIConfig()

      const stream = suggestPlanItems(
        { repo, subjectRepo, aiAdapter, aiConfig, logger: noopLogger },
        { planId: "plan-1", userId: "user-1", prompt: "テスト" }
      )

      const chunks = await collectChunks(stream)

      const errorChunks = chunks.filter((c) => c.type === "error")
      expect(errorChunks.length).toBeGreaterThan(0)
    })

    it("既存要素がない状態でも提案を実行する", async () => {
      const plan = createMockPlan({ intent: null, subjectName: null })
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        findPlanById: vi.fn().mockResolvedValue(plan),
        findItemsByPlan: vi.fn().mockResolvedValue([]),
      })
      const subjectRepo = createMockSubjectRepo()
      const aiAdapter = createMockAIAdapter()
      const aiConfig = createMockAIConfig()

      const stream = suggestPlanItems(
        { repo, subjectRepo, aiAdapter, aiConfig, logger: noopLogger },
        { planId: "plan-1", userId: "user-1", prompt: "何から始めるべきですか？" }
      )

      const chunks = await collectChunks(stream)

      const textChunks = chunks.filter((c) => c.type === "text")
      expect(textChunks.length).toBeGreaterThan(0)
    })
  })
})
