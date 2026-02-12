/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, vi } from "vitest"
import type { TopicViewRepository, TopicViewData } from "./repositories/topicViewRepo"
import type { SubjectDashboardViewRepository, SubjectDashboardData } from "./repositories/subjectDashboardViewRepo"
import type { ReviewListViewRepository, ReviewListData, ReviewListFilters } from "./repositories/reviewListViewRepo"
import type { CategoryTopicsViewRepository, CategoryTopicsData } from "./repositories/categoryTopicsViewRepo"
import type { SearchViewRepository } from "./repositories/searchViewRepo"
import type { SearchTopicsResponse } from "@cpa-study/shared/schemas"
import type { ViewDeps } from "./usecase"
import { noopLogger } from "../../test/helpers"
import {
  getTopicView,
  getSubjectDashboard,
  getReviewList,
  getCategoryTopics,
  searchTopics,
} from "./usecase"

// Mock data
const mockTopicViewData: TopicViewData = {
  topic: {
    id: "topic-1",
    name: "減価償却",
    description: "固定資産の減価償却に関する論点",
    categoryId: "category-1",
    categoryName: "固定資産",
    subjectId: "subject-1",
    subjectName: "財務会計論",
    difficulty: "medium",
    topicType: "calculation",
    displayOrder: 1,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-15T00:00:00Z"),
  },
  progress: {
    id: "progress-1",
    userId: "user-1",
    topicId: "topic-1",
    understood: true,
    lastAccessedAt: new Date("2024-01-10T00:00:00Z"),
    questionCount: 5,
    goodQuestionCount: 3,
    createdAt: new Date("2024-01-05T00:00:00Z"),
    updatedAt: new Date("2024-01-10T00:00:00Z"),
  },
  recentNotes: [
    { id: "note-1", title: "定額法と定率法の比較", updatedAt: new Date("2024-01-12T00:00:00Z") },
    { id: "note-2", title: "耐用年数の決定", updatedAt: new Date("2024-01-08T00:00:00Z") },
  ],
  recentSessions: [
    { id: "session-1", createdAt: new Date("2024-01-14T00:00:00Z") },
    { id: "session-2", createdAt: new Date("2024-01-09T00:00:00Z") },
  ],
}

const mockSubjectDashboardData: SubjectDashboardData = {
  subject: {
    id: "subject-1",
    name: "財務会計論",
    emoji: "📊",
    color: "indigo",
  },
  stats: {
    categoryCount: 5,
    topicCount: 25,
    completedCount: 10,
    progressPercentage: 40,
  },
  recentTopics: [
    { id: "topic-1", name: "減価償却", lastAccessedAt: new Date("2024-01-15T00:00:00Z") },
    { id: "topic-2", name: "棚卸資産", lastAccessedAt: new Date("2024-01-14T00:00:00Z") },
    { id: "topic-3", name: "有価証券", lastAccessedAt: null },
  ],
}

const mockReviewListData: ReviewListData = {
  topics: [
    {
      id: "topic-1",
      name: "減価償却",
      subjectId: "subject-1",
      subjectName: "財務会計論",
      categoryId: "category-1",
      understood: true,
      lastAccessedAt: new Date("2024-01-15T00:00:00Z"),
      sessionCount: 3,
    },
    {
      id: "topic-2",
      name: "棚卸資産",
      subjectId: "subject-1",
      subjectName: "財務会計論",
      categoryId: "category-2",
      understood: false,
      lastAccessedAt: null,
      sessionCount: 0,
    },
  ],
  total: 10,
}

const mockCategoryTopicsData: CategoryTopicsData = {
  category: {
    id: "category-1",
    name: "固定資産",
  },
  topics: [
    { id: "topic-1", name: "減価償却", description: "償却計算の基礎", displayOrder: 1 },
    { id: "topic-2", name: "減損会計", description: "減損の認識と測定", displayOrder: 2 },
    { id: "topic-3", name: "リース会計", description: null, displayOrder: 3 },
  ],
}

const mockSearchResults: SearchTopicsResponse = {
  results: [
    {
      id: "topic-1",
      name: "減価償却",
      subjectId: "subject-1",
      subjectName: "財務会計論",
      categoryId: "category-1",
      categoryName: "固定資産",
    },
    {
      id: "topic-4",
      name: "減損会計",
      subjectId: "subject-1",
      subjectName: "財務会計論",
      categoryId: "category-1",
      categoryName: "固定資産",
    },
  ],
  total: 2,
}

// Helper to create mock repositories
const createMockTopicViewRepository = (
  overrides: Partial<TopicViewRepository> = {}
): TopicViewRepository => ({
  getTopicView: vi.fn().mockResolvedValue(mockTopicViewData),
  ...overrides,
})

const createMockSubjectDashboardViewRepository = (
  overrides: Partial<SubjectDashboardViewRepository> = {}
): SubjectDashboardViewRepository => ({
  getSubjectDashboard: vi.fn().mockResolvedValue(mockSubjectDashboardData),
  ...overrides,
})

const createMockReviewListViewRepository = (
  overrides: Partial<ReviewListViewRepository> = {}
): ReviewListViewRepository => ({
  getReviewList: vi.fn().mockResolvedValue(mockReviewListData),
  ...overrides,
})

const createMockCategoryTopicsViewRepository = (
  overrides: Partial<CategoryTopicsViewRepository> = {}
): CategoryTopicsViewRepository => ({
  getCategoryTopics: vi.fn().mockResolvedValue(mockCategoryTopicsData),
  ...overrides,
})

const createMockSearchViewRepository = (
  overrides: Partial<SearchViewRepository> = {}
): SearchViewRepository => ({
  searchTopics: vi.fn().mockResolvedValue(mockSearchResults),
  ...overrides,
})

const createMockDeps = (overrides: Partial<ViewDeps> = {}): ViewDeps => ({
  topicViewRepo: createMockTopicViewRepository(),
  subjectDashboardViewRepo: createMockSubjectDashboardViewRepository(),
  reviewListViewRepo: createMockReviewListViewRepository(),
  categoryTopicsViewRepo: createMockCategoryTopicsViewRepository(),
  searchViewRepo: createMockSearchViewRepository(),
  logger: noopLogger,
  ...overrides,
})

describe("View UseCase", () => {
  describe("getTopicView", () => {
    it("should return topic view data", async () => {
      const deps = createMockDeps()

      const result = await getTopicView(deps, "user-1", "topic-1")

      expect(deps.topicViewRepo.getTopicView).toHaveBeenCalledWith("topic-1", "user-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.topic.id).toBe("topic-1")
      expect(result.value.topic.name).toBe("減価償却")
      expect(result.value.topic.categoryName).toBe("固定資産")
      expect(result.value.progress?.understood).toBe(true)
      expect(result.value.recentNotes).toHaveLength(2)
      expect(result.value.recentSessions).toHaveLength(2)
    })

    it("should convert dates to ISO strings", async () => {
      const deps = createMockDeps()

      const result = await getTopicView(deps, "user-1", "topic-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.topic.createdAt).toBe("2024-01-01T00:00:00.000Z")
      expect(result.value.topic.updatedAt).toBe("2024-01-15T00:00:00.000Z")
      expect(result.value.progress?.lastAccessedAt).toBe("2024-01-10T00:00:00.000Z")
      expect(result.value.progress?.createdAt).toBe("2024-01-05T00:00:00.000Z")
      expect(result.value.recentNotes[0].updatedAt).toBe("2024-01-12T00:00:00.000Z")
      expect(result.value.recentSessions[0].createdAt).toBe("2024-01-14T00:00:00.000Z")
    })

    it("should return NOT_FOUND error when topic does not exist", async () => {
      const deps = createMockDeps({
        topicViewRepo: createMockTopicViewRepository({
          getTopicView: vi.fn().mockResolvedValue(null),
        }),
      })

      const result = await getTopicView(deps, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
      expect(result.error.message).toBe("論点が見つかりません")
    })

    it("should handle topic without progress", async () => {
      const dataWithoutProgress: TopicViewData = {
        ...mockTopicViewData,
        progress: null,
      }
      const deps = createMockDeps({
        topicViewRepo: createMockTopicViewRepository({
          getTopicView: vi.fn().mockResolvedValue(dataWithoutProgress),
        }),
      })

      const result = await getTopicView(deps, "user-1", "topic-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.progress).toBeNull()
    })
  })

  describe("getSubjectDashboard", () => {
    it("should return subject dashboard data", async () => {
      const deps = createMockDeps()

      const result = await getSubjectDashboard(deps, "user-1", "subject-1")

      expect(deps.subjectDashboardViewRepo.getSubjectDashboard).toHaveBeenCalledWith("subject-1", "user-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.subject.id).toBe("subject-1")
      expect(result.value.subject.name).toBe("財務会計論")
      expect(result.value.stats.categoryCount).toBe(5)
      expect(result.value.stats.topicCount).toBe(25)
      expect(result.value.stats.progressPercentage).toBe(40)
      expect(result.value.recentTopics).toHaveLength(3)
    })

    it("should convert dates to ISO strings for recent topics", async () => {
      const deps = createMockDeps()

      const result = await getSubjectDashboard(deps, "user-1", "subject-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.recentTopics[0].lastAccessedAt).toBe("2024-01-15T00:00:00.000Z")
      expect(result.value.recentTopics[2].lastAccessedAt).toBeNull()
    })

    it("should return NOT_FOUND error when subject does not exist", async () => {
      const deps = createMockDeps({
        subjectDashboardViewRepo: createMockSubjectDashboardViewRepository({
          getSubjectDashboard: vi.fn().mockResolvedValue(null),
        }),
      })

      const result = await getSubjectDashboard(deps, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
      expect(result.error.message).toBe("科目が見つかりません")
    })
  })

  describe("getReviewList", () => {
    it("should return review list data", async () => {
      const deps = createMockDeps()

      const result = await getReviewList(deps, "user-1")

      expect(deps.reviewListViewRepo.getReviewList).toHaveBeenCalledWith("user-1", undefined)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.topics).toHaveLength(2)
      expect(result.value.total).toBe(10)
      expect(result.value.topics[0].name).toBe("減価償却")
      expect(result.value.topics[1].understood).toBe(false)
    })

    it("should convert dates to ISO strings", async () => {
      const deps = createMockDeps()

      const result = await getReviewList(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.topics[0].lastAccessedAt).toBe("2024-01-15T00:00:00.000Z")
      expect(result.value.topics[1].lastAccessedAt).toBeNull()
    })

    it("should pass filters to repository", async () => {
      const deps = createMockDeps()
      const filters: ReviewListFilters = {
        understood: false,
        daysSince: 7,
        limit: 20,
      }

      await getReviewList(deps, "user-1", filters)

      expect(deps.reviewListViewRepo.getReviewList).toHaveBeenCalledWith("user-1", filters)
    })
  })

  describe("getCategoryTopics", () => {
    it("should return category topics data", async () => {
      const deps = createMockDeps()

      const result = await getCategoryTopics(deps, "user-1", "category-1")

      expect(deps.categoryTopicsViewRepo?.getCategoryTopics).toHaveBeenCalledWith("category-1", "user-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.category.id).toBe("category-1")
      expect(result.value.category.name).toBe("固定資産")
      expect(result.value.topics).toHaveLength(3)
      expect(result.value.topics[0].name).toBe("減価償却")
      expect(result.value.topics[2].description).toBeNull()
    })

    it("should return NOT_FOUND error when category does not exist", async () => {
      const deps = createMockDeps({
        categoryTopicsViewRepo: createMockCategoryTopicsViewRepository({
          getCategoryTopics: vi.fn().mockResolvedValue(null),
        }),
      })

      const result = await getCategoryTopics(deps, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
      expect(result.error.message).toBe("単元が見つかりません")
    })

    it("should return NOT_FOUND error when repo is not configured", async () => {
      const deps = createMockDeps({
        categoryTopicsViewRepo: undefined,
      })

      const result = await getCategoryTopics(deps, "user-1", "category-1")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
      expect(result.error.message).toBe("CategoryTopicsViewRepository not configured")
    })
  })

  describe("searchTopics", () => {
    it("should return search results", async () => {
      const deps = createMockDeps()

      const result = await searchTopics(deps, "user-1", "減")

      expect(deps.searchViewRepo?.searchTopics).toHaveBeenCalledWith("user-1", "減", undefined, undefined)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.results).toHaveLength(2)
      expect(result.value.total).toBe(2)
      expect(result.value.results[0].name).toBe("減価償却")
      expect(result.value.results[1].name).toBe("減損会計")
    })

    it("should pass studyDomainId and limit to repository", async () => {
      const deps = createMockDeps()

      await searchTopics(deps, "user-1", "減価", "domain-1", 10)

      expect(deps.searchViewRepo?.searchTopics).toHaveBeenCalledWith("user-1", "減価", "domain-1", 10)
    })

    it("should return NOT_FOUND error when repo is not configured", async () => {
      const deps = createMockDeps({
        searchViewRepo: undefined,
      })

      const result = await searchTopics(deps, "user-1", "減")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
      expect(result.error.message).toBe("SearchViewRepository not configured")
    })
  })
})
