/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, vi } from "vitest"
import type {
  LearningRepository,
  TopicProgress,
  CheckHistoryRecord,
  RecentTopicRow,
} from "./repository"
import {
  touchTopic,
  getProgress,
  updateProgress,
  listUserProgress,
  getCheckHistory,
  listRecentTopics,
  getSubjectProgressStats,
} from "./usecase"
import type { SubjectRepository } from "../subject/repository"
import { noopLogger } from "../../test/helpers"

// Mock data
const mockProgress: TopicProgress = {
  id: "progress-1",
  userId: "user-1",
  topicId: "topic-1",
  understood: false,
  lastAccessedAt: new Date("2024-01-15T10:00:00Z"),
  questionCount: 5,
  goodQuestionCount: 3,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-15T10:00:00Z"),
}

const mockCheckHistory: CheckHistoryRecord = {
  id: "history-1",
  topicId: "topic-1",
  userId: "user-1",
  action: "checked",
  checkedAt: new Date("2024-01-15T10:00:00Z"),
}

const mockRecentTopic: RecentTopicRow = {
  topicId: "topic-1",
  topicName: "減価償却",
  domainId: "domain-1",
  subjectId: "subject-1",
  subjectName: "財務会計論",
  categoryId: "category-1",
  lastAccessedAt: new Date("2024-01-15T10:00:00Z"),
}

// Helper to create mock repository
const createMockLearningRepository = (
  overrides: Partial<LearningRepository> = {}
): LearningRepository => ({
  verifyTopicExists: vi.fn().mockResolvedValue(true),
  touchTopic: vi.fn().mockResolvedValue(mockProgress),
  findProgress: vi.fn().mockResolvedValue(mockProgress),
  upsertProgress: vi.fn().mockResolvedValue(mockProgress),
  findProgressByUser: vi.fn().mockResolvedValue([mockProgress]),
  createCheckHistory: vi.fn().mockResolvedValue(mockCheckHistory),
  findCheckHistoryByTopic: vi.fn().mockResolvedValue([mockCheckHistory]),
  findRecentTopics: vi.fn().mockResolvedValue([mockRecentTopic]),
  ...overrides,
})

describe("Learning UseCase", () => {
  describe("touchTopic", () => {
    it("should update lastAccessedAt and return progress", async () => {
      const learningRepo = createMockLearningRepository()
      const deps = { learningRepo, logger: noopLogger }

      const result = await touchTopic(deps, "user-1", "topic-1")

      expect(learningRepo.verifyTopicExists).toHaveBeenCalledWith("user-1", "topic-1")
      expect(learningRepo.touchTopic).toHaveBeenCalledWith("user-1", "topic-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.topicId).toBe("topic-1")
      expect(result.value.lastAccessedAt).toBe("2024-01-15T10:00:00.000Z")
    })

    it("should return error when topic not found", async () => {
      const learningRepo = createMockLearningRepository({
        verifyTopicExists: vi.fn().mockResolvedValue(false),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await touchTopic(deps, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
      expect(learningRepo.touchTopic).not.toHaveBeenCalled()
    })
  })

  describe("getProgress", () => {
    it("should return progress when exists", async () => {
      const learningRepo = createMockLearningRepository()
      const deps = { learningRepo, logger: noopLogger }

      const result = await getProgress(deps, "user-1", "topic-1")

      expect(learningRepo.verifyTopicExists).toHaveBeenCalledWith("user-1", "topic-1")
      expect(learningRepo.findProgress).toHaveBeenCalledWith("user-1", "topic-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).not.toBeNull()
      expect(result.value?.topicId).toBe("topic-1")
      expect(result.value?.understood).toBe(false)
      expect(result.value?.questionCount).toBe(5)
    })

    it("should return null when no progress exists", async () => {
      const learningRepo = createMockLearningRepository({
        findProgress: vi.fn().mockResolvedValue(null),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await getProgress(deps, "user-1", "topic-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toBeNull()
    })

    it("should return error when topic not found", async () => {
      const learningRepo = createMockLearningRepository({
        verifyTopicExists: vi.fn().mockResolvedValue(false),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await getProgress(deps, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
      expect(learningRepo.findProgress).not.toHaveBeenCalled()
    })

    it("should convert dates to ISO strings", async () => {
      const learningRepo = createMockLearningRepository()
      const deps = { learningRepo, logger: noopLogger }

      const result = await getProgress(deps, "user-1", "topic-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value?.createdAt).toBe("2024-01-01T00:00:00.000Z")
      expect(result.value?.updatedAt).toBe("2024-01-15T10:00:00.000Z")
    })
  })

  describe("updateProgress", () => {
    it("should create new progress", async () => {
      const newProgress: TopicProgress = {
        ...mockProgress,
        understood: true,
      }
      const learningRepo = createMockLearningRepository({
        findProgress: vi.fn().mockResolvedValue(null),
        upsertProgress: vi.fn().mockResolvedValue(newProgress),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await updateProgress(deps, "user-1", "topic-1", true)

      expect(learningRepo.upsertProgress).toHaveBeenCalledWith("user-1", {
        userId: "user-1",
        topicId: "topic-1",
        understood: true,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.understood).toBe(true)
    })

    it("should update existing progress", async () => {
      const updatedProgress: TopicProgress = {
        ...mockProgress,
        understood: true,
        updatedAt: new Date("2024-01-20T10:00:00Z"),
      }
      const learningRepo = createMockLearningRepository({
        upsertProgress: vi.fn().mockResolvedValue(updatedProgress),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await updateProgress(deps, "user-1", "topic-1", true)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.understood).toBe(true)
      expect(result.value.updatedAt).toBe("2024-01-20T10:00:00.000Z")
    })

    it("should create check history when understood changes from false to true", async () => {
      const updatedProgress: TopicProgress = {
        ...mockProgress,
        understood: true,
      }
      const learningRepo = createMockLearningRepository({
        findProgress: vi.fn().mockResolvedValue(mockProgress), // understood: false
        upsertProgress: vi.fn().mockResolvedValue(updatedProgress),
      })
      const deps = { learningRepo, logger: noopLogger }

      await updateProgress(deps, "user-1", "topic-1", true)

      expect(learningRepo.createCheckHistory).toHaveBeenCalledWith("user-1", {
        userId: "user-1",
        topicId: "topic-1",
        action: "checked",
      })
    })

    it("should create check history when understood changes from true to false", async () => {
      const existingProgress: TopicProgress = {
        ...mockProgress,
        understood: true,
      }
      const updatedProgress: TopicProgress = {
        ...mockProgress,
        understood: false,
      }
      const learningRepo = createMockLearningRepository({
        findProgress: vi.fn().mockResolvedValue(existingProgress),
        upsertProgress: vi.fn().mockResolvedValue(updatedProgress),
      })
      const deps = { learningRepo, logger: noopLogger }

      await updateProgress(deps, "user-1", "topic-1", false)

      expect(learningRepo.createCheckHistory).toHaveBeenCalledWith("user-1", {
        userId: "user-1",
        topicId: "topic-1",
        action: "unchecked",
      })
    })

    it("should not create history when understood is unchanged", async () => {
      const learningRepo = createMockLearningRepository({
        findProgress: vi.fn().mockResolvedValue(mockProgress), // understood: false
        upsertProgress: vi.fn().mockResolvedValue(mockProgress),
      })
      const deps = { learningRepo, logger: noopLogger }

      await updateProgress(deps, "user-1", "topic-1", false)

      expect(learningRepo.createCheckHistory).not.toHaveBeenCalled()
    })

    it("should not create history when understood is undefined", async () => {
      const learningRepo = createMockLearningRepository()
      const deps = { learningRepo, logger: noopLogger }

      await updateProgress(deps, "user-1", "topic-1", undefined)

      expect(learningRepo.createCheckHistory).not.toHaveBeenCalled()
    })

    it("should return error when topic not found", async () => {
      const learningRepo = createMockLearningRepository({
        verifyTopicExists: vi.fn().mockResolvedValue(false),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await updateProgress(deps, "user-1", "non-existent", true)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
      expect(learningRepo.upsertProgress).not.toHaveBeenCalled()
    })
  })

  describe("listUserProgress", () => {
    it("should return all progress for user", async () => {
      const progressList: TopicProgress[] = [
        mockProgress,
        { ...mockProgress, id: "progress-2", topicId: "topic-2" },
      ]
      const learningRepo = createMockLearningRepository({
        findProgressByUser: vi.fn().mockResolvedValue(progressList),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await listUserProgress(deps, "user-1")

      expect(learningRepo.findProgressByUser).toHaveBeenCalledWith("user-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(2)
      expect(result.value[0].topicId).toBe("topic-1")
      expect(result.value[1].topicId).toBe("topic-2")
    })

    it("should return empty array when no progress exists", async () => {
      const learningRepo = createMockLearningRepository({
        findProgressByUser: vi.fn().mockResolvedValue([]),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await listUserProgress(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(0)
    })

    it("should convert dates to ISO strings", async () => {
      const learningRepo = createMockLearningRepository()
      const deps = { learningRepo, logger: noopLogger }

      const result = await listUserProgress(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value[0].createdAt).toBe("2024-01-01T00:00:00.000Z")
      expect(result.value[0].updatedAt).toBe("2024-01-15T10:00:00.000Z")
    })
  })

  describe("getCheckHistory", () => {
    it("should return check history for topic", async () => {
      const historyList: CheckHistoryRecord[] = [
        mockCheckHistory,
        { ...mockCheckHistory, id: "history-2", action: "unchecked" },
      ]
      const learningRepo = createMockLearningRepository({
        findCheckHistoryByTopic: vi.fn().mockResolvedValue(historyList),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await getCheckHistory(deps, "user-1", "topic-1")

      expect(learningRepo.verifyTopicExists).toHaveBeenCalledWith("user-1", "topic-1")
      expect(learningRepo.findCheckHistoryByTopic).toHaveBeenCalledWith("user-1", "topic-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(2)
      expect(result.value[0].action).toBe("checked")
      expect(result.value[1].action).toBe("unchecked")
    })

    it("should return empty array when no history exists", async () => {
      const learningRepo = createMockLearningRepository({
        findCheckHistoryByTopic: vi.fn().mockResolvedValue([]),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await getCheckHistory(deps, "user-1", "topic-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(0)
    })

    it("should return error when topic not found", async () => {
      const learningRepo = createMockLearningRepository({
        verifyTopicExists: vi.fn().mockResolvedValue(false),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await getCheckHistory(deps, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
      expect(learningRepo.findCheckHistoryByTopic).not.toHaveBeenCalled()
    })

    it("should convert dates to ISO strings", async () => {
      const learningRepo = createMockLearningRepository()
      const deps = { learningRepo, logger: noopLogger }

      const result = await getCheckHistory(deps, "user-1", "topic-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value[0].checkedAt).toBe("2024-01-15T10:00:00.000Z")
    })
  })

  describe("listRecentTopics", () => {
    it("should return recent topics", async () => {
      const recentTopics: RecentTopicRow[] = [
        mockRecentTopic,
        {
          ...mockRecentTopic,
          topicId: "topic-2",
          topicName: "棚卸資産",
          lastAccessedAt: new Date("2024-01-14T10:00:00Z"),
        },
      ]
      const learningRepo = createMockLearningRepository({
        findRecentTopics: vi.fn().mockResolvedValue(recentTopics),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await listRecentTopics(deps, "user-1")

      expect(learningRepo.findRecentTopics).toHaveBeenCalledWith("user-1", 10)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(2)
      expect(result.value[0].topicName).toBe("減価償却")
      expect(result.value[1].topicName).toBe("棚卸資産")
    })

    it("should respect custom limit", async () => {
      const learningRepo = createMockLearningRepository()
      const deps = { learningRepo, logger: noopLogger }

      await listRecentTopics(deps, "user-1", 5)

      expect(learningRepo.findRecentTopics).toHaveBeenCalledWith("user-1", 5)
    })

    it("should return empty array when no recent topics", async () => {
      const learningRepo = createMockLearningRepository({
        findRecentTopics: vi.fn().mockResolvedValue([]),
      })
      const deps = { learningRepo, logger: noopLogger }

      const result = await listRecentTopics(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(0)
    })

    it("should convert dates to ISO strings", async () => {
      const learningRepo = createMockLearningRepository()
      const deps = { learningRepo, logger: noopLogger }

      const result = await listRecentTopics(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value[0].lastAccessedAt).toBe("2024-01-15T10:00:00.000Z")
    })
  })

  describe("getSubjectProgressStats", () => {
    it("should return subject progress stats", async () => {
      const mockSubjects = [
        { id: "subject-1", name: "財務会計論" },
        { id: "subject-2", name: "管理会計論" },
      ]
      const mockProgressCounts = [
        { subjectId: "subject-1", understoodCount: 5 },
        { subjectId: "subject-2", understoodCount: 3 },
      ]
      const mockBatchStats = [
        { subjectId: "subject-1", topicCount: 10 },
        { subjectId: "subject-2", topicCount: 8 },
      ]

      const subjectRepo = {
        findAllSubjectsForUser: vi.fn().mockResolvedValue(mockSubjects),
        getProgressCountsBySubject: vi.fn().mockResolvedValue(mockProgressCounts),
        getBatchSubjectStats: vi.fn().mockResolvedValue(mockBatchStats),
      } as unknown as SubjectRepository

      const deps = { subjectRepo, logger: noopLogger }

      const result = await getSubjectProgressStats(deps, "user-1")

      expect(subjectRepo.findAllSubjectsForUser).toHaveBeenCalledWith(undefined, "user-1")
      expect(subjectRepo.getProgressCountsBySubject).toHaveBeenCalledWith("user-1")
      expect(subjectRepo.getBatchSubjectStats).toHaveBeenCalledWith(
        ["subject-1", "subject-2"],
        "user-1"
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(2)
      expect(result.value[0]).toEqual({
        subjectId: "subject-1",
        subjectName: "財務会計論",
        totalTopics: 10,
        understoodTopics: 5,
      })
      expect(result.value[1]).toEqual({
        subjectId: "subject-2",
        subjectName: "管理会計論",
        totalTopics: 8,
        understoodTopics: 3,
      })
    })

    it("should return zero counts for subjects without progress", async () => {
      const mockSubjects = [{ id: "subject-1", name: "財務会計論" }]
      const mockProgressCounts: { subjectId: string; understoodCount: number }[] = []
      const mockBatchStats: { subjectId: string; topicCount: number }[] = []

      const subjectRepo = {
        findAllSubjectsForUser: vi.fn().mockResolvedValue(mockSubjects),
        getProgressCountsBySubject: vi.fn().mockResolvedValue(mockProgressCounts),
        getBatchSubjectStats: vi.fn().mockResolvedValue(mockBatchStats),
      } as unknown as SubjectRepository

      const deps = { subjectRepo, logger: noopLogger }

      const result = await getSubjectProgressStats(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value[0]).toEqual({
        subjectId: "subject-1",
        subjectName: "財務会計論",
        totalTopics: 0,
        understoodTopics: 0,
      })
    })

    it("should return empty array when no subjects", async () => {
      const subjectRepo = {
        findAllSubjectsForUser: vi.fn().mockResolvedValue([]),
        getProgressCountsBySubject: vi.fn().mockResolvedValue([]),
        getBatchSubjectStats: vi.fn().mockResolvedValue([]),
      } as unknown as SubjectRepository

      const deps = { subjectRepo, logger: noopLogger }

      const result = await getSubjectProgressStats(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(0)
    })
  })
})
