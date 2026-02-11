/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, vi } from "vitest"
import type {
  BookmarkRepository,
  Bookmark,
  BookmarkDetails,
} from "./repository"
import {
  getBookmarks,
  addBookmark,
  removeBookmark,
} from "./usecase"

// Mock data
const mockBookmark: Bookmark = {
  id: "bookmark-1",
  userId: "user-1",
  targetType: "topic",
  targetId: "topic-1",
  createdAt: new Date("2024-01-01T00:00:00Z"),
}

const mockBookmarkDetails: BookmarkDetails = {
  name: "棚卸資産の評価",
  path: "財務会計論 > 棚卸資産 > 棚卸資産の評価",
  domainId: "domain-1",
  subjectId: "subject-1",
  categoryId: "category-1",
}

// Helper to create mock repository
const createMockRepository = (overrides: Partial<BookmarkRepository> = {}): BookmarkRepository => ({
  findBookmarksByUser: vi.fn().mockResolvedValue([mockBookmark]),
  addBookmark: vi.fn().mockResolvedValue({ bookmark: mockBookmark, alreadyExists: false }),
  removeBookmark: vi.fn().mockResolvedValue(true),
  isBookmarked: vi.fn().mockResolvedValue(false),
  targetExists: vi.fn().mockResolvedValue(true),
  getBookmarkDetails: vi.fn().mockResolvedValue(mockBookmarkDetails),
  ...overrides,
})

describe("Bookmark UseCase", () => {
  describe("getBookmarks", () => {
    it("should return empty array when no bookmarks exist", async () => {
      const repo = createMockRepository({
        findBookmarksByUser: vi.fn().mockResolvedValue([]),
      })
      const deps = { repo }

      const result = await getBookmarks(deps, "user-1")

      expect(repo.findBookmarksByUser).toHaveBeenCalledWith("user-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(0)
    })

    it("should return bookmarks with details", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await getBookmarks(deps, "user-1")

      expect(repo.findBookmarksByUser).toHaveBeenCalledWith("user-1")
      expect(repo.getBookmarkDetails).toHaveBeenCalledWith("topic", "topic-1", "user-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(1)
      expect(result.value[0]).toEqual({
        id: "bookmark-1",
        targetType: "topic",
        targetId: "topic-1",
        name: "棚卸資産の評価",
        path: "財務会計論 > 棚卸資産 > 棚卸資産の評価",
        domainId: "domain-1",
        subjectId: "subject-1",
        categoryId: "category-1",
        createdAt: "2024-01-01T00:00:00.000Z",
      })
    })

    it("should convert dates to ISO strings", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await getBookmarks(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value[0].createdAt).toBe("2024-01-01T00:00:00.000Z")
    })

    it("should filter out deleted targets (when getBookmarkDetails returns null)", async () => {
      const bookmarks: Bookmark[] = [
        mockBookmark,
        {
          id: "bookmark-2",
          userId: "user-1",
          targetType: "topic",
          targetId: "deleted-topic",
          createdAt: new Date("2024-01-02T00:00:00Z"),
        },
      ]
      const repo = createMockRepository({
        findBookmarksByUser: vi.fn().mockResolvedValue(bookmarks),
        getBookmarkDetails: vi.fn().mockImplementation((targetType, targetId) => {
          if (targetId === "deleted-topic") {
            return Promise.resolve(null) // Deleted target returns null
          }
          return Promise.resolve(mockBookmarkDetails)
        }),
      })
      const deps = { repo }

      const result = await getBookmarks(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(1) // Only non-deleted bookmark
      expect(result.value[0].targetId).toBe("topic-1")
    })

    it("should return multiple bookmarks with different target types", async () => {
      const bookmarks: Bookmark[] = [
        mockBookmark,
        {
          id: "bookmark-2",
          userId: "user-1",
          targetType: "subject",
          targetId: "subject-1",
          createdAt: new Date("2024-01-02T00:00:00Z"),
        },
        {
          id: "bookmark-3",
          userId: "user-1",
          targetType: "category",
          targetId: "category-1",
          createdAt: new Date("2024-01-03T00:00:00Z"),
        },
      ]
      const subjectDetails: BookmarkDetails = {
        name: "財務会計論",
        path: "財務会計論",
        domainId: "domain-1",
        subjectId: null,
        categoryId: null,
      }
      const categoryDetails: BookmarkDetails = {
        name: "棚卸資産",
        path: "財務会計論 > 棚卸資産",
        domainId: "domain-1",
        subjectId: "subject-1",
        categoryId: null,
      }
      const repo = createMockRepository({
        findBookmarksByUser: vi.fn().mockResolvedValue(bookmarks),
        getBookmarkDetails: vi.fn().mockImplementation((targetType: string) => {
          switch (targetType) {
            case "topic":
              return Promise.resolve(mockBookmarkDetails)
            case "subject":
              return Promise.resolve(subjectDetails)
            case "category":
              return Promise.resolve(categoryDetails)
            default:
              return Promise.resolve(null)
          }
        }),
      })
      const deps = { repo }

      const result = await getBookmarks(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(3)
      expect(result.value[0].targetType).toBe("topic")
      expect(result.value[1].targetType).toBe("subject")
      expect(result.value[2].targetType).toBe("category")
    })
  })

  describe("addBookmark", () => {
    it("should add new bookmark successfully", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await addBookmark(deps, "user-1", "topic", "topic-1")

      expect(repo.targetExists).toHaveBeenCalledWith("topic", "topic-1", "user-1")
      expect(repo.addBookmark).toHaveBeenCalledWith("user-1", "topic", "topic-1")
      expect(repo.getBookmarkDetails).toHaveBeenCalledWith("topic", "topic-1", "user-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.alreadyExists).toBe(false)
      expect(result.value.bookmark).not.toBeNull()
      expect(result.value.bookmark?.id).toBe("bookmark-1")
      expect(result.value.bookmark?.name).toBe("棚卸資産の評価")
    })

    it("should return alreadyExists=true for duplicate bookmark", async () => {
      const repo = createMockRepository({
        addBookmark: vi.fn().mockResolvedValue({ bookmark: null, alreadyExists: true }),
      })
      const deps = { repo }

      const result = await addBookmark(deps, "user-1", "topic", "topic-1")

      expect(repo.targetExists).toHaveBeenCalledWith("topic", "topic-1", "user-1")
      expect(repo.addBookmark).toHaveBeenCalledWith("user-1", "topic", "topic-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.alreadyExists).toBe(true)
      expect(result.value.bookmark).toBeNull()
    })

    it("should return error for non-existent target", async () => {
      const repo = createMockRepository({
        targetExists: vi.fn().mockResolvedValue(false),
      })
      const deps = { repo }

      const result = await addBookmark(deps, "user-1", "topic", "non-existent")

      expect(repo.targetExists).toHaveBeenCalledWith("topic", "non-existent", "user-1")
      expect(repo.addBookmark).not.toHaveBeenCalled()
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })

    it("should convert dates to ISO strings in bookmark response", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await addBookmark(deps, "user-1", "topic", "topic-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.bookmark?.createdAt).toBe("2024-01-01T00:00:00.000Z")
    })

    it("should add bookmark for subject target type", async () => {
      const subjectBookmark: Bookmark = {
        id: "bookmark-subject",
        userId: "user-1",
        targetType: "subject",
        targetId: "subject-1",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      }
      const subjectDetails: BookmarkDetails = {
        name: "財務会計論",
        path: "財務会計論",
        domainId: "domain-1",
        subjectId: null,
        categoryId: null,
      }
      const repo = createMockRepository({
        addBookmark: vi.fn().mockResolvedValue({ bookmark: subjectBookmark, alreadyExists: false }),
        getBookmarkDetails: vi.fn().mockResolvedValue(subjectDetails),
      })
      const deps = { repo }

      const result = await addBookmark(deps, "user-1", "subject", "subject-1")

      expect(repo.addBookmark).toHaveBeenCalledWith("user-1", "subject", "subject-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.bookmark?.targetType).toBe("subject")
      expect(result.value.bookmark?.name).toBe("財務会計論")
    })

    it("should add bookmark for category target type", async () => {
      const categoryBookmark: Bookmark = {
        id: "bookmark-category",
        userId: "user-1",
        targetType: "category",
        targetId: "category-1",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      }
      const categoryDetails: BookmarkDetails = {
        name: "棚卸資産",
        path: "財務会計論 > 棚卸資産",
        domainId: "domain-1",
        subjectId: "subject-1",
        categoryId: null,
      }
      const repo = createMockRepository({
        addBookmark: vi.fn().mockResolvedValue({ bookmark: categoryBookmark, alreadyExists: false }),
        getBookmarkDetails: vi.fn().mockResolvedValue(categoryDetails),
      })
      const deps = { repo }

      const result = await addBookmark(deps, "user-1", "category", "category-1")

      expect(repo.addBookmark).toHaveBeenCalledWith("user-1", "category", "category-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.bookmark?.targetType).toBe("category")
      expect(result.value.bookmark?.name).toBe("棚卸資産")
    })
  })

  describe("removeBookmark", () => {
    it("should remove existing bookmark successfully", async () => {
      const repo = createMockRepository({
        removeBookmark: vi.fn().mockResolvedValue(true),
      })
      const deps = { repo }

      const result = await removeBookmark(deps, "user-1", "topic", "topic-1")

      expect(repo.removeBookmark).toHaveBeenCalledWith("user-1", "topic", "topic-1")
      expect(result.ok).toBe(true)
    })

    it("should return error for non-existent bookmark", async () => {
      const repo = createMockRepository({
        removeBookmark: vi.fn().mockResolvedValue(false),
      })
      const deps = { repo }

      const result = await removeBookmark(deps, "user-1", "topic", "non-existent")

      expect(repo.removeBookmark).toHaveBeenCalledWith("user-1", "topic", "non-existent")
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })

    it("should remove bookmark for subject target type", async () => {
      const repo = createMockRepository({
        removeBookmark: vi.fn().mockResolvedValue(true),
      })
      const deps = { repo }

      const result = await removeBookmark(deps, "user-1", "subject", "subject-1")

      expect(repo.removeBookmark).toHaveBeenCalledWith("user-1", "subject", "subject-1")
      expect(result.ok).toBe(true)
    })

    it("should remove bookmark for category target type", async () => {
      const repo = createMockRepository({
        removeBookmark: vi.fn().mockResolvedValue(true),
      })
      const deps = { repo }

      const result = await removeBookmark(deps, "user-1", "category", "category-1")

      expect(repo.removeBookmark).toHaveBeenCalledWith("user-1", "category", "category-1")
      expect(result.ok).toBe(true)
    })
  })

  // === 境界値テスト ===

  describe("addBookmark 境界値", () => {
    it("targetType='subject'でtargetExistsが正しい引数で呼ばれる", async () => {
      const repo = createMockRepository({
        targetExists: vi.fn().mockResolvedValue(true),
      })
      const deps = { repo }

      await addBookmark(deps, "user-1", "subject", "subject-1")

      expect(repo.targetExists).toHaveBeenCalledWith("subject", "subject-1", "user-1")
    })

    it("targetType='category'でtargetExistsが正しい引数で呼ばれる", async () => {
      const repo = createMockRepository({
        targetExists: vi.fn().mockResolvedValue(true),
      })
      const deps = { repo }

      await addBookmark(deps, "user-1", "category", "category-1")

      expect(repo.targetExists).toHaveBeenCalledWith("category", "category-1", "user-1")
    })

    it("同一ターゲットの二重追加でalreadyExists応答が返る", async () => {
      const repo = createMockRepository({
        targetExists: vi.fn().mockResolvedValue(true),
        addBookmark: vi.fn().mockResolvedValue({ bookmark: null, alreadyExists: true }),
        getBookmarkDetails: vi.fn().mockResolvedValue(mockBookmarkDetails),
      })
      const deps = { repo }

      const result = await addBookmark(deps, "user-1", "topic", "topic-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.alreadyExists).toBe(true)
      expect(result.value.bookmark).toBeNull()
    })
  })
})
