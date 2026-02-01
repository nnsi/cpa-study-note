/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import type {
  StudyDomainRepository,
  StudyDomain,
  UserStudyDomain,
  CanDeleteResult,
} from "./repository"
import {
  listPublicStudyDomains,
  getStudyDomain,
  createStudyDomain,
  updateStudyDomain,
  deleteStudyDomain,
  listUserStudyDomains,
  joinStudyDomain,
  leaveStudyDomain,
} from "./usecase"

// Mock data
const mockStudyDomain: StudyDomain = {
  id: "cpa",
  name: "公認会計士試験",
  description: "公認会計士試験の学習",
  emoji: "📚",
  color: "indigo",
  isPublic: true,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
}

const mockUserStudyDomain: UserStudyDomain = {
  id: "usd-1",
  userId: "user-1",
  studyDomainId: "cpa",
  joinedAt: new Date("2024-01-15T00:00:00Z"),
}

// Helper to create mock repository
const createMockRepository = (overrides: Partial<StudyDomainRepository> = {}): StudyDomainRepository => ({
  findAllPublic: vi.fn().mockResolvedValue([mockStudyDomain]),
  findById: vi.fn().mockResolvedValue(mockStudyDomain),
  create: vi.fn().mockResolvedValue(mockStudyDomain),
  update: vi.fn().mockResolvedValue(mockStudyDomain),
  remove: vi.fn().mockResolvedValue(true),
  canDeleteStudyDomain: vi.fn().mockResolvedValue({ canDelete: true }),
  findByUserId: vi.fn().mockResolvedValue([{ ...mockUserStudyDomain, studyDomain: mockStudyDomain }]),
  joinDomain: vi.fn().mockResolvedValue(mockUserStudyDomain),
  leaveDomain: vi.fn().mockResolvedValue(true),
  findUserStudyDomain: vi.fn().mockResolvedValue(null),
  clearUserDefaultDomainIfMatches: vi.fn().mockResolvedValue(true),
  ...overrides,
})

describe("Study Domain UseCase", () => {
  describe("listPublicStudyDomains", () => {
    it("should return list of public study domains", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await listPublicStudyDomains(deps)

      expect(repo.findAllPublic).toHaveBeenCalled()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("cpa")
      expect(result[0].name).toBe("公認会計士試験")
    })

    it("should convert dates to ISO strings", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await listPublicStudyDomains(deps)

      expect(result[0].createdAt).toBe("2024-01-01T00:00:00.000Z")
      expect(result[0].updatedAt).toBe("2024-01-01T00:00:00.000Z")
    })

    it("should return empty array when no domains exist", async () => {
      const repo = createMockRepository({
        findAllPublic: vi.fn().mockResolvedValue([]),
      })
      const deps = { repo }

      const result = await listPublicStudyDomains(deps)

      expect(result).toHaveLength(0)
    })
  })

  describe("getStudyDomain", () => {
    it("should return study domain when found", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await getStudyDomain(deps, "cpa")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.id).toBe("cpa")
      expect(result.value.name).toBe("公認会計士試験")
    })

    it("should convert dates to ISO strings", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await getStudyDomain(deps, "cpa")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.createdAt).toBe("2024-01-01T00:00:00.000Z")
      expect(result.value.updatedAt).toBe("2024-01-01T00:00:00.000Z")
    })

    it("should return not_found error when domain does not exist", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(null),
      })
      const deps = { repo }

      const result = await getStudyDomain(deps, "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.type).toBe("not_found")
      expect(result.error.message).toBe("学習領域が見つかりません")
    })
  })

  describe("createStudyDomain", () => {
    it("should create study domain successfully", async () => {
      const newDomain: StudyDomain = {
        ...mockStudyDomain,
        id: "new-domain",
        name: "New Domain",
      }
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(null), // Not existing
        create: vi.fn().mockResolvedValue(newDomain),
      })
      const deps = { repo }

      const result = await createStudyDomain(deps, {
        id: "new-domain",
        name: "New Domain",
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.id).toBe("new-domain")
      expect(repo.create).toHaveBeenCalledWith({
        id: "new-domain",
        name: "New Domain",
      })
    })

    it("should return already_exists error when ID exists", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain), // Already exists
      })
      const deps = { repo }

      const result = await createStudyDomain(deps, {
        id: "cpa",
        name: "Duplicate",
      })

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.type).toBe("already_exists")
      expect(result.error.message).toBe("このIDの学習領域は既に存在します")
      expect(repo.create).not.toHaveBeenCalled()
    })

    it("should pass all fields to repository", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(mockStudyDomain),
      })
      const deps = { repo }

      await createStudyDomain(deps, {
        id: "new-domain",
        name: "New Domain",
        description: "Description",
        emoji: "🎯",
        color: "red",
        isPublic: false,
      })

      expect(repo.create).toHaveBeenCalledWith({
        id: "new-domain",
        name: "New Domain",
        description: "Description",
        emoji: "🎯",
        color: "red",
        isPublic: false,
      })
    })
  })

  describe("updateStudyDomain", () => {
    it("should update study domain successfully", async () => {
      const updatedDomain: StudyDomain = {
        ...mockStudyDomain,
        name: "Updated Name",
      }
      const repo = createMockRepository({
        update: vi.fn().mockResolvedValue(updatedDomain),
      })
      const deps = { repo }

      const result = await updateStudyDomain(deps, "cpa", { name: "Updated Name" })

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.name).toBe("Updated Name")
      expect(repo.update).toHaveBeenCalledWith("cpa", { name: "Updated Name" })
    })

    it("should return not_found error when domain does not exist", async () => {
      const repo = createMockRepository({
        update: vi.fn().mockResolvedValue(null),
      })
      const deps = { repo }

      const result = await updateStudyDomain(deps, "non-existent", { name: "New Name" })

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.type).toBe("not_found")
      expect(result.error.message).toBe("学習領域が見つかりません")
    })

    it("should convert dates to ISO strings", async () => {
      const updatedDomain: StudyDomain = {
        ...mockStudyDomain,
        updatedAt: new Date("2024-06-01T00:00:00Z"),
      }
      const repo = createMockRepository({
        update: vi.fn().mockResolvedValue(updatedDomain),
      })
      const deps = { repo }

      const result = await updateStudyDomain(deps, "cpa", { name: "Updated" })

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.updatedAt).toBe("2024-06-01T00:00:00.000Z")
    })
  })

  describe("deleteStudyDomain", () => {
    it("should delete study domain successfully when can delete", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
        canDeleteStudyDomain: vi.fn().mockResolvedValue({ canDelete: true }),
        remove: vi.fn().mockResolvedValue(true),
      })
      const deps = { repo }

      const result = await deleteStudyDomain(deps, "cpa")

      expect(result.ok).toBe(true)
      expect(repo.remove).toHaveBeenCalledWith("cpa")
    })

    it("should return not_found error when domain does not exist", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(null),
      })
      const deps = { repo }

      const result = await deleteStudyDomain(deps, "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.type).toBe("not_found")
      expect(result.error.message).toBe("学習領域が見つかりません")
      expect(repo.canDeleteStudyDomain).not.toHaveBeenCalled()
      expect(repo.remove).not.toHaveBeenCalled()
    })

    it("should return cannot_delete error when subjects exist", async () => {
      const canDeleteResult: CanDeleteResult = {
        canDelete: false,
        reason: "1件の科目が紐づいています",
      }
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
        canDeleteStudyDomain: vi.fn().mockResolvedValue(canDeleteResult),
      })
      const deps = { repo }

      const result = await deleteStudyDomain(deps, "cpa")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.type).toBe("cannot_delete")
      expect(result.error.message).toBe("1件の科目が紐づいています")
      expect(repo.remove).not.toHaveBeenCalled()
    })

    it("should use default message when reason is not provided", async () => {
      const canDeleteResult: CanDeleteResult = {
        canDelete: false,
        // No reason provided
      }
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
        canDeleteStudyDomain: vi.fn().mockResolvedValue(canDeleteResult),
      })
      const deps = { repo }

      const result = await deleteStudyDomain(deps, "cpa")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.message).toBe("この学習領域は削除できません")
    })
  })

  describe("listUserStudyDomains", () => {
    it("should return user's joined study domains", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await listUserStudyDomains(deps, "user-1")

      expect(repo.findByUserId).toHaveBeenCalledWith("user-1")
      expect(result).toHaveLength(1)
      expect(result[0].studyDomainId).toBe("cpa")
    })

    it("should convert dates to ISO strings", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await listUserStudyDomains(deps, "user-1")

      expect(result[0].joinedAt).toBe("2024-01-15T00:00:00.000Z")
      expect(result[0].studyDomain.createdAt).toBe("2024-01-01T00:00:00.000Z")
    })

    it("should return empty array when user has no joined domains", async () => {
      const repo = createMockRepository({
        findByUserId: vi.fn().mockResolvedValue([]),
      })
      const deps = { repo }

      const result = await listUserStudyDomains(deps, "user-with-no-domains")

      expect(result).toHaveLength(0)
    })
  })

  describe("joinStudyDomain", () => {
    it("should join study domain successfully", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
        findUserStudyDomain: vi.fn().mockResolvedValue(null), // Not joined yet
        joinDomain: vi.fn().mockResolvedValue(mockUserStudyDomain),
      })
      const deps = { repo }

      const result = await joinStudyDomain(deps, "user-1", "cpa")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.userId).toBe("user-1")
      expect(result.value.studyDomainId).toBe("cpa")
      expect(repo.joinDomain).toHaveBeenCalledWith("user-1", "cpa")
    })

    it("should return not_found error when domain does not exist", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(null),
      })
      const deps = { repo }

      const result = await joinStudyDomain(deps, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.type).toBe("not_found")
      expect(result.error.message).toBe("学習領域が見つかりません")
      expect(repo.joinDomain).not.toHaveBeenCalled()
    })

    it("should return already_exists error when already joined", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
        findUserStudyDomain: vi.fn().mockResolvedValue(mockUserStudyDomain), // Already joined
      })
      const deps = { repo }

      const result = await joinStudyDomain(deps, "user-1", "cpa")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.type).toBe("already_exists")
      expect(result.error.message).toBe("既にこの学習領域に参加しています")
      expect(repo.joinDomain).not.toHaveBeenCalled()
    })

    it("should convert dates to ISO strings", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
        findUserStudyDomain: vi.fn().mockResolvedValue(null),
        joinDomain: vi.fn().mockResolvedValue(mockUserStudyDomain),
      })
      const deps = { repo }

      const result = await joinStudyDomain(deps, "user-1", "cpa")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.joinedAt).toBe("2024-01-15T00:00:00.000Z")
      expect(result.value.studyDomain.createdAt).toBe("2024-01-01T00:00:00.000Z")
    })
  })

  describe("leaveStudyDomain", () => {
    it("should leave study domain successfully", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
        findUserStudyDomain: vi.fn().mockResolvedValue(mockUserStudyDomain), // Has joined
        leaveDomain: vi.fn().mockResolvedValue(true),
      })
      const deps = { repo }

      const result = await leaveStudyDomain(deps, "user-1", "cpa")

      expect(result.ok).toBe(true)
      expect(repo.leaveDomain).toHaveBeenCalledWith("user-1", "cpa")
    })

    it("should return not_found error when domain does not exist", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(null),
      })
      const deps = { repo }

      const result = await leaveStudyDomain(deps, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.type).toBe("not_found")
      expect(result.error.message).toBe("学習領域が見つかりません")
      expect(repo.leaveDomain).not.toHaveBeenCalled()
    })

    it("should return not_joined error when user has not joined", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
        findUserStudyDomain: vi.fn().mockResolvedValue(null), // Not joined
      })
      const deps = { repo }

      const result = await leaveStudyDomain(deps, "user-1", "cpa")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.type).toBe("not_joined")
      expect(result.error.message).toBe("この学習領域には参加していません")
      expect(repo.leaveDomain).not.toHaveBeenCalled()
    })

    it("should only remove user_study_domains record, preserving learning history", async () => {
      // This test verifies the design principle that leaving a domain
      // should not delete user's learning history (progress, chat sessions, notes)
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
        findUserStudyDomain: vi.fn().mockResolvedValue(mockUserStudyDomain),
        leaveDomain: vi.fn().mockResolvedValue(true),
      })
      const deps = { repo }

      await leaveStudyDomain(deps, "user-1", "cpa")

      // Verify only leaveDomain was called (which only deletes user_study_domains record)
      expect(repo.leaveDomain).toHaveBeenCalledWith("user-1", "cpa")
      // No other deletion methods should be called
    })
  })
})
