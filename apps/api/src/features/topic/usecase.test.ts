/**
 * Topic UseCase のテスト
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import type { TopicRepository } from "./repository"
import {
  listSubjects,
  getSubject,
  listCategoriesHierarchy,
  listTopicsByCategory,
  getTopicWithProgress,
  updateProgress,
  listUserProgress,
  getSubjectProgressStats,
} from "./usecase"

// テストデータ生成ヘルパー
const createMockDate = (offset = 0) => new Date(Date.now() + offset)

const createMockSubject = (overrides = {}) => ({
  id: "subject-1",
  name: "財務会計論",
  description: "財務会計論の科目",
  displayOrder: 1,
  createdAt: createMockDate(),
  updatedAt: createMockDate(),
  ...overrides,
})

const createMockCategory = (overrides = {}) => ({
  id: "category-1",
  subjectId: "subject-1",
  name: "計算",
  depth: 0,
  parentId: null,
  displayOrder: 1,
  createdAt: createMockDate(),
  updatedAt: createMockDate(),
  ...overrides,
})

const createMockTopic = (overrides = {}) => ({
  id: "topic-1",
  categoryId: "category-1",
  name: "有価証券",
  description: "有価証券の評価と会計処理",
  difficulty: "medium",
  topicType: null,
  aiSystemPrompt: null,
  displayOrder: 1,
  createdAt: createMockDate(),
  updatedAt: createMockDate(),
  ...overrides,
})

const createMockProgress = (overrides = {}) => ({
  id: "progress-1",
  userId: "user-1",
  topicId: "topic-1",
  understood: false,
  lastAccessedAt: null,
  questionCount: 0,
  goodQuestionCount: 0,
  createdAt: createMockDate(),
  updatedAt: createMockDate(),
  ...overrides,
})

// モックリポジトリファクトリ
const createMockRepo = (overrides: Partial<TopicRepository> = {}): TopicRepository => ({
  findAllSubjects: vi.fn().mockResolvedValue([]),
  findSubjectById: vi.fn().mockResolvedValue(null),
  getSubjectStats: vi.fn().mockResolvedValue({ categoryCount: 0, topicCount: 0 }),
  findCategoriesBySubjectId: vi.fn().mockResolvedValue([]),
  findCategoryById: vi.fn().mockResolvedValue(null),
  getCategoryTopicCounts: vi.fn().mockResolvedValue([]),
  findTopicsByCategoryId: vi.fn().mockResolvedValue([]),
  findTopicById: vi.fn().mockResolvedValue(null),
  findProgress: vi.fn().mockResolvedValue(null),
  upsertProgress: vi.fn().mockResolvedValue(createMockProgress()),
  findProgressByUser: vi.fn().mockResolvedValue([]),
  getProgressCountsByCategory: vi.fn().mockResolvedValue([]),
  getProgressCountsBySubject: vi.fn().mockResolvedValue([]),
  ...overrides,
})

describe("Topic UseCase", () => {
  describe("listSubjects", () => {
    it("科目一覧をカテゴリ数・論点数含めて取得する", async () => {
      const mockSubject = createMockSubject()
      const repo = createMockRepo({
        findAllSubjects: vi.fn().mockResolvedValue([mockSubject]),
        getSubjectStats: vi.fn().mockResolvedValue({ categoryCount: 3, topicCount: 15 }),
      })

      const result = await listSubjects({ repo })

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: "subject-1",
        name: "財務会計論",
        categoryCount: 3,
        topicCount: 15,
      })
      expect(result[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it("複数の科目を取得する", async () => {
      const subjects = [
        createMockSubject({ id: "subject-1", name: "財務会計論" }),
        createMockSubject({ id: "subject-2", name: "管理会計論" }),
      ]
      const repo = createMockRepo({
        findAllSubjects: vi.fn().mockResolvedValue(subjects),
        getSubjectStats: vi.fn()
          .mockResolvedValueOnce({ categoryCount: 3, topicCount: 15 })
          .mockResolvedValueOnce({ categoryCount: 2, topicCount: 10 }),
      })

      const result = await listSubjects({ repo })

      expect(result).toHaveLength(2)
      expect(result[0].categoryCount).toBe(3)
      expect(result[1].categoryCount).toBe(2)
    })
  })

  describe("getSubject", () => {
    it("科目詳細を取得する", async () => {
      const mockSubject = createMockSubject()
      const repo = createMockRepo({
        findSubjectById: vi.fn().mockResolvedValue(mockSubject),
        getSubjectStats: vi.fn().mockResolvedValue({ categoryCount: 5, topicCount: 20 }),
      })

      const result = await getSubject({ repo }, "subject-1")

      expect(result).not.toBeNull()
      expect(result!.id).toBe("subject-1")
      expect(result!.categoryCount).toBe(5)
      expect(result!.topicCount).toBe(20)
    })

    it("存在しない科目でnullを返す", async () => {
      const repo = createMockRepo({
        findSubjectById: vi.fn().mockResolvedValue(null),
      })

      const result = await getSubject({ repo }, "non-existent")

      expect(result).toBeNull()
    })
  })

  describe("listCategoriesHierarchy", () => {
    it("階層構造を構築する", async () => {
      const categories = [
        createMockCategory({ id: "cat-1", depth: 0, parentId: null }),
        createMockCategory({ id: "cat-2", depth: 1, parentId: "cat-1" }),
        createMockCategory({ id: "cat-3", depth: 1, parentId: "cat-1" }),
      ]
      const repo = createMockRepo({
        findCategoriesBySubjectId: vi.fn().mockResolvedValue(categories),
        getCategoryTopicCounts: vi.fn().mockResolvedValue([
          { categoryId: "cat-1", topicCount: 5 },
          { categoryId: "cat-2", topicCount: 3 },
          { categoryId: "cat-3", topicCount: 2 },
        ]),
      })

      const result = await listCategoriesHierarchy({ repo }, "subject-1")

      // ルートカテゴリは1つ
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("cat-1")
      expect(result[0].topicCount).toBe(5)
      // 子カテゴリが2つ
      expect(result[0].children).toHaveLength(2)
      expect(result[0].children[0].id).toBe("cat-2")
      expect(result[0].children[1].id).toBe("cat-3")
    })

    it("ユーザー進捗を含めて取得する", async () => {
      const categories = [
        createMockCategory({ id: "cat-1", depth: 0, parentId: null }),
      ]
      const repo = createMockRepo({
        findCategoriesBySubjectId: vi.fn().mockResolvedValue(categories),
        getCategoryTopicCounts: vi.fn().mockResolvedValue([
          { categoryId: "cat-1", topicCount: 10 },
        ]),
        getProgressCountsByCategory: vi.fn().mockResolvedValue([
          { categoryId: "cat-1", understoodCount: 7 },
        ]),
      })

      const result = await listCategoriesHierarchy({ repo }, "subject-1", "user-1")

      expect(result[0].topicCount).toBe(10)
      expect(result[0].understoodCount).toBe(7)
      expect(repo.getProgressCountsByCategory).toHaveBeenCalledWith("user-1", "subject-1")
    })

    it("userIdがない場合は進捗を取得しない", async () => {
      const categories = [createMockCategory()]
      const repo = createMockRepo({
        findCategoriesBySubjectId: vi.fn().mockResolvedValue(categories),
        getCategoryTopicCounts: vi.fn().mockResolvedValue([]),
      })

      await listCategoriesHierarchy({ repo }, "subject-1")

      expect(repo.getProgressCountsByCategory).not.toHaveBeenCalled()
    })
  })

  describe("listTopicsByCategory", () => {
    it("カテゴリ内の論点一覧を取得する", async () => {
      const topics = [
        createMockTopic({ id: "topic-1", name: "有価証券" }),
        createMockTopic({ id: "topic-2", name: "棚卸資産" }),
      ]
      const repo = createMockRepo({
        findTopicsByCategoryId: vi.fn().mockResolvedValue(topics),
      })

      const result = await listTopicsByCategory({ repo }, "category-1")

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe("topic-1")
      expect(result[0].name).toBe("有価証券")
      expect(result[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe("getTopicWithProgress", () => {
    it("論点詳細を取得する", async () => {
      const mockTopic = createMockTopic()
      const mockProgress = createMockProgress({ understood: true })
      const repo = createMockRepo({
        findTopicById: vi.fn().mockResolvedValue(mockTopic),
        findProgress: vi.fn().mockResolvedValue(mockProgress),
        upsertProgress: vi.fn().mockResolvedValue(mockProgress),
      })

      const result = await getTopicWithProgress({ repo }, "user-1", "topic-1")

      expect(result).not.toBeNull()
      expect(result!.id).toBe("topic-1")
      expect(result!.progress).not.toBeNull()
      expect(result!.progress!.understood).toBe(true)
    })

    it("アクセス記録を更新する", async () => {
      const mockTopic = createMockTopic()
      const repo = createMockRepo({
        findTopicById: vi.fn().mockResolvedValue(mockTopic),
        findProgress: vi.fn().mockResolvedValue(null),
        upsertProgress: vi.fn().mockResolvedValue(createMockProgress()),
      })

      await getTopicWithProgress({ repo }, "user-1", "topic-1")

      expect(repo.upsertProgress).toHaveBeenCalledWith({
        userId: "user-1",
        topicId: "topic-1",
      })
    })

    it("存在しない論点でnullを返す", async () => {
      const repo = createMockRepo({
        findTopicById: vi.fn().mockResolvedValue(null),
      })

      const result = await getTopicWithProgress({ repo }, "user-1", "non-existent")

      expect(result).toBeNull()
    })
  })

  describe("updateProgress", () => {
    it("理解フラグをtrueに更新する（understood）", async () => {
      const updatedProgress = createMockProgress({ understood: true })
      const repo = createMockRepo({
        upsertProgress: vi.fn().mockResolvedValue(updatedProgress),
      })

      const result = await updateProgress({ repo }, "user-1", "topic-1", true)

      expect(result.understood).toBe(true)
      expect(repo.upsertProgress).toHaveBeenCalledWith({
        userId: "user-1",
        topicId: "topic-1",
        understood: true,
      })
    })

    it("理解フラグをfalseに更新する（struggling）", async () => {
      const updatedProgress = createMockProgress({ understood: false })
      const repo = createMockRepo({
        upsertProgress: vi.fn().mockResolvedValue(updatedProgress),
      })

      const result = await updateProgress({ repo }, "user-1", "topic-1", false)

      expect(result.understood).toBe(false)
      expect(repo.upsertProgress).toHaveBeenCalledWith({
        userId: "user-1",
        topicId: "topic-1",
        understood: false,
      })
    })

    it("日付がISO形式で返される", async () => {
      const now = new Date()
      const progress = createMockProgress({
        lastAccessedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      const repo = createMockRepo({
        upsertProgress: vi.fn().mockResolvedValue(progress),
      })

      const result = await updateProgress({ repo }, "user-1", "topic-1", true)

      expect(result.lastAccessedAt).toBe(now.toISOString())
      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe("listUserProgress", () => {
    it("ユーザーの全進捗を取得する", async () => {
      const progressList = [
        createMockProgress({ topicId: "topic-1", understood: true }),
        createMockProgress({ topicId: "topic-2", understood: false }),
      ]
      const repo = createMockRepo({
        findProgressByUser: vi.fn().mockResolvedValue(progressList),
      })

      const result = await listUserProgress({ repo }, "user-1")

      expect(result).toHaveLength(2)
      expect(result[0].topicId).toBe("topic-1")
      expect(result[0].understood).toBe(true)
    })

    it("進捗がない場合は空配列を返す", async () => {
      const repo = createMockRepo({
        findProgressByUser: vi.fn().mockResolvedValue([]),
      })

      const result = await listUserProgress({ repo }, "user-1")

      expect(result).toEqual([])
    })
  })

  describe("getSubjectProgressStats", () => {
    it("科目別統計を計算する", async () => {
      const subjects = [
        createMockSubject({ id: "subject-1", name: "財務会計論" }),
        createMockSubject({ id: "subject-2", name: "管理会計論" }),
      ]
      const repo = createMockRepo({
        findAllSubjects: vi.fn().mockResolvedValue(subjects),
        getSubjectStats: vi.fn()
          .mockResolvedValueOnce({ categoryCount: 5, topicCount: 30 })
          .mockResolvedValueOnce({ categoryCount: 3, topicCount: 20 }),
        getProgressCountsBySubject: vi.fn().mockResolvedValue([
          { subjectId: "subject-1", understoodCount: 25 },
          { subjectId: "subject-2", understoodCount: 10 },
        ]),
      })

      const result = await getSubjectProgressStats({ repo }, "user-1")

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        subjectId: "subject-1",
        subjectName: "財務会計論",
        totalTopics: 30,
        understoodTopics: 25,
      })
      expect(result[1]).toMatchObject({
        subjectId: "subject-2",
        subjectName: "管理会計論",
        totalTopics: 20,
        understoodTopics: 10,
      })
    })

    it("進捗がない科目はunderstoodTopicsが0になる", async () => {
      const subjects = [createMockSubject({ id: "subject-1" })]
      const repo = createMockRepo({
        findAllSubjects: vi.fn().mockResolvedValue(subjects),
        getSubjectStats: vi.fn().mockResolvedValue({ categoryCount: 2, topicCount: 10 }),
        getProgressCountsBySubject: vi.fn().mockResolvedValue([]), // 進捗なし
      })

      const result = await getSubjectProgressStats({ repo }, "user-1")

      expect(result[0].understoodTopics).toBe(0)
    })
  })
})
