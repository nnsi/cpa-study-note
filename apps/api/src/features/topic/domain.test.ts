import { describe, it, expect } from "vitest"
import {
  subjectSchema,
  categorySchema,
  topicSchema,
  userTopicProgressSchema,
  difficultySchema,
  topicTypeSchema,
  subjectWithStatsSchema,
  categoryWithChildrenSchema,
  topicWithProgressSchema,
  subjectResponseSchema,
  categoryResponseSchema,
  topicResponseSchema,
} from "@cpa-study/shared/schemas"

// Note: repository.ts defines internal types (Subject, Category, Topic, TopicProgress)
// that use Date objects, while shared schemas use datetime strings for API responses

describe("Topic Domain Types", () => {
  describe("subjectSchema (Zod)", () => {
    it("should parse valid subject data", () => {
      const data = {
        id: "subject-123",
        userId: "user-123",
        studyDomainId: "cpa",
        name: "Financial Accounting",
        description: "Introduction to financial accounting principles",
        emoji: "📊",
        color: "indigo",
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        deletedAt: null,
      }

      const result = subjectSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe("Financial Accounting")
        expect(result.data.description).toBe(
          "Introduction to financial accounting principles"
        )
        expect(result.data.studyDomainId).toBe("cpa")
        expect(result.data.emoji).toBe("📊")
        expect(result.data.color).toBe("indigo")
        expect(result.data.userId).toBe("user-123")
      }
    })

    it("should accept null description", () => {
      const data = {
        id: "subject-123",
        userId: "user-123",
        studyDomainId: "cpa",
        name: "Financial Accounting",
        description: null,
        emoji: null,
        color: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        deletedAt: null,
      }

      const result = subjectSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it("should reject missing required fields", () => {
      const data = {
        id: "subject-123",
        name: "Financial Accounting",
      }

      const result = subjectSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe("categorySchema (Zod)", () => {
    it("should parse valid category data", () => {
      const data = {
        id: "category-123",
        userId: "user-123",
        subjectId: "subject-123",
        name: "Assets",
        depth: 0,
        parentId: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        deletedAt: null,
      }

      const result = categorySchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe("Assets")
        expect(result.data.depth).toBe(0)
        expect(result.data.parentId).toBeNull()
        expect(result.data.userId).toBe("user-123")
      }
    })

    it("should parse nested category with parentId", () => {
      const data = {
        id: "category-456",
        userId: "user-123",
        subjectId: "subject-123",
        name: "Current Assets",
        depth: 1,
        parentId: "category-123",
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        deletedAt: null,
      }

      const result = categorySchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.parentId).toBe("category-123")
        expect(result.data.depth).toBe(1)
      }
    })
  })

  describe("topicSchema (Zod)", () => {
    it("should parse valid topic data", () => {
      const data = {
        id: "topic-123",
        userId: "user-123",
        categoryId: "category-123",
        name: "Depreciation Methods",
        description: "Understanding different depreciation methods",
        difficulty: "intermediate",
        topicType: "calculation",
        aiSystemPrompt: "You are a helpful accounting tutor...",
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        deletedAt: null,
      }

      const result = topicSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.difficulty).toBe("intermediate")
        expect(result.data.topicType).toBe("calculation")
        expect(result.data.userId).toBe("user-123")
      }
    })

    it("should accept null for optional fields", () => {
      const data = {
        id: "topic-123",
        userId: "user-123",
        categoryId: "category-123",
        name: "Basic Concepts",
        description: null,
        difficulty: null,
        topicType: null,
        aiSystemPrompt: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        deletedAt: null,
      }

      const result = topicSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe("userTopicProgressSchema (Zod)", () => {
    it("should parse valid progress data", () => {
      const data = {
        id: "progress-123",
        userId: "user-123",
        topicId: "topic-123",
        understood: true,
        lastAccessedAt: "2024-01-15T10:00:00.000Z",
        questionCount: 5,
        goodQuestionCount: 3,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = userTopicProgressSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.understood).toBe(true)
        expect(result.data.questionCount).toBe(5)
        expect(result.data.goodQuestionCount).toBe(3)
      }
    })

    it("should accept null lastAccessedAt", () => {
      const data = {
        id: "progress-123",
        userId: "user-123",
        topicId: "topic-123",
        understood: false,
        lastAccessedAt: null,
        questionCount: 0,
        goodQuestionCount: 0,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = userTopicProgressSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe("difficultySchema (Zod)", () => {
    it("should accept valid difficulty levels", () => {
      expect(difficultySchema.parse("basic")).toBe("basic")
      expect(difficultySchema.parse("intermediate")).toBe("intermediate")
      expect(difficultySchema.parse("advanced")).toBe("advanced")
    })

    it("should reject invalid difficulty", () => {
      const result = difficultySchema.safeParse("expert")
      expect(result.success).toBe(false)
    })
  })

  describe("topicTypeSchema (Zod)", () => {
    it("should accept valid topic types", () => {
      expect(topicTypeSchema.parse("theory")).toBe("theory")
      expect(topicTypeSchema.parse("calculation")).toBe("calculation")
      expect(topicTypeSchema.parse("mixed")).toBe("mixed")
    })

    it("should reject invalid topic type", () => {
      const result = topicTypeSchema.safeParse("practice")
      expect(result.success).toBe(false)
    })
  })

  describe("subjectWithStatsSchema (Zod)", () => {
    it("should parse subject with stats", () => {
      const data = {
        id: "subject-123",
        userId: "user-123",
        studyDomainId: "cpa",
        name: "Financial Accounting",
        description: null,
        emoji: "📊",
        color: "indigo",
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        categoryCount: 10,
        topicCount: 50,
        completedCount: 25,
      }

      const result = subjectWithStatsSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.categoryCount).toBe(10)
        expect(result.data.topicCount).toBe(50)
        expect(result.data.completedCount).toBe(25)
      }
    })

    it("should allow optional completedCount", () => {
      const data = {
        id: "subject-123",
        userId: "user-123",
        studyDomainId: "cpa",
        name: "Financial Accounting",
        description: null,
        emoji: null,
        color: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        categoryCount: 10,
        topicCount: 50,
      }

      const result = subjectWithStatsSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe("categoryWithChildrenSchema (Zod)", () => {
    it("should parse category with children", () => {
      const data = {
        id: "category-123",
        userId: "user-123",
        subjectId: "subject-123",
        name: "Assets",
        depth: 0,
        parentId: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        children: [
          {
            id: "category-456",
            userId: "user-123",
            subjectId: "subject-123",
            name: "Current Assets",
            depth: 1,
            parentId: "category-123",
            displayOrder: 1,
            createdAt: "2024-01-15T10:00:00.000Z",
            updatedAt: "2024-01-15T10:00:00.000Z",
          },
        ],
      }

      const result = categoryWithChildrenSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.children).toHaveLength(1)
        expect(result.data.children![0].name).toBe("Current Assets")
      }
    })

    it("should parse category with topics", () => {
      const data = {
        id: "category-123",
        userId: "user-123",
        subjectId: "subject-123",
        name: "Depreciation",
        depth: 0,
        parentId: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        topics: [
          {
            id: "topic-123",
            userId: "user-123",
            categoryId: "category-123",
            name: "Straight-line Method",
            description: null,
            difficulty: "basic",
            topicType: "calculation",
            aiSystemPrompt: null,
            displayOrder: 1,
            createdAt: "2024-01-15T10:00:00.000Z",
            updatedAt: "2024-01-15T10:00:00.000Z",
          },
        ],
      }

      const result = categoryWithChildrenSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.topics).toHaveLength(1)
        expect(result.data.topics![0].name).toBe("Straight-line Method")
      }
    })
  })

  describe("topicWithProgressSchema (Zod)", () => {
    it("should parse topic with progress", () => {
      const data = {
        id: "topic-123",
        userId: "user-123",
        categoryId: "category-123",
        name: "Depreciation Methods",
        description: null,
        difficulty: "intermediate",
        topicType: "calculation",
        aiSystemPrompt: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        progress: {
          id: "progress-123",
          userId: "user-123",
          topicId: "topic-123",
          understood: true,
          lastAccessedAt: "2024-01-15T10:00:00.000Z",
          questionCount: 5,
          goodQuestionCount: 3,
          createdAt: "2024-01-15T10:00:00.000Z",
          updatedAt: "2024-01-15T10:00:00.000Z",
        },
      }

      const result = topicWithProgressSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.progress).not.toBeNull()
        expect(result.data.progress?.understood).toBe(true)
      }
    })

    it("should parse topic with null progress", () => {
      const data = {
        id: "topic-123",
        userId: "user-123",
        categoryId: "category-123",
        name: "New Topic",
        description: null,
        difficulty: null,
        topicType: null,
        aiSystemPrompt: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
        progress: null,
      }

      const result = topicWithProgressSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.progress).toBeNull()
      }
    })
  })

  describe("Response schemas (omit deletedAt)", () => {
    it("should parse subject response without deletedAt", () => {
      const data = {
        id: "subject-123",
        userId: "user-123",
        studyDomainId: "cpa",
        name: "Financial Accounting",
        description: null,
        emoji: null,
        color: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = subjectResponseSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it("should parse category response without deletedAt", () => {
      const data = {
        id: "category-123",
        userId: "user-123",
        subjectId: "subject-123",
        name: "Assets",
        depth: 0,
        parentId: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = categoryResponseSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it("should parse topic response without deletedAt", () => {
      const data = {
        id: "topic-123",
        userId: "user-123",
        categoryId: "category-123",
        name: "Depreciation",
        description: null,
        difficulty: null,
        topicType: null,
        aiSystemPrompt: null,
        displayOrder: 1,
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }

      const result = topicResponseSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })
})
