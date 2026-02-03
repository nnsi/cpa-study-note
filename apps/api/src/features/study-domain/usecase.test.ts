/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, vi } from "vitest"
import type {
  StudyDomainRepository,
  StudyDomain,
  CanDeleteResult,
} from "./repository"
import {
  listStudyDomains,
  getStudyDomain,
  createStudyDomain,
  updateStudyDomain,
  deleteStudyDomain,
} from "./usecase"

// Mock data
const mockStudyDomain: StudyDomain = {
  id: "domain-1",
  userId: "user-1",
  name: "公認会計士試験",
  description: "公認会計士試験の学習",
  emoji: "📚",
  color: "indigo",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  deletedAt: null,
}

// Helper to create mock repository
const createMockRepository = (overrides: Partial<StudyDomainRepository> = {}): StudyDomainRepository => ({
  findByUserId: vi.fn().mockResolvedValue([mockStudyDomain]),
  findById: vi.fn().mockResolvedValue(mockStudyDomain),
  create: vi.fn().mockResolvedValue({ id: mockStudyDomain.id }),
  update: vi.fn().mockResolvedValue(mockStudyDomain),
  softDelete: vi.fn().mockResolvedValue(true),
  canDeleteStudyDomain: vi.fn().mockResolvedValue({ canDelete: true }),
  ...overrides,
})

describe("Study Domain UseCase", () => {
  describe("listStudyDomains", () => {
    it("should return user's study domains", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await listStudyDomains(deps, "user-1")

      expect(repo.findByUserId).toHaveBeenCalledWith("user-1")
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(1)
      expect(result.value[0].id).toBe("domain-1")
      expect(result.value[0].name).toBe("公認会計士試験")
    })

    it("should convert dates to ISO strings", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await listStudyDomains(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value[0].createdAt).toBe("2024-01-01T00:00:00.000Z")
      expect(result.value[0].updatedAt).toBe("2024-01-01T00:00:00.000Z")
    })

    it("should return empty array when no domains exist", async () => {
      const repo = createMockRepository({
        findByUserId: vi.fn().mockResolvedValue([]),
      })
      const deps = { repo }

      const result = await listStudyDomains(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(0)
    })
  })

  describe("getStudyDomain", () => {
    it("should return study domain when found", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await getStudyDomain(deps, "domain-1", "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.id).toBe("domain-1")
      expect(result.value.name).toBe("公認会計士試験")
      expect(repo.findById).toHaveBeenCalledWith("domain-1", "user-1")
    })

    it("should convert dates to ISO strings", async () => {
      const repo = createMockRepository()
      const deps = { repo }

      const result = await getStudyDomain(deps, "domain-1", "user-1")

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

      const result = await getStudyDomain(deps, "non-existent", "user-1")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
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
        create: vi.fn().mockResolvedValue({ id: "new-domain" }),
        findById: vi.fn().mockResolvedValue(newDomain),
      })
      const deps = { repo }

      const result = await createStudyDomain(deps, "user-1", {
        name: "New Domain",
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.id).toBe("new-domain")
      expect(repo.create).toHaveBeenCalledWith({
        userId: "user-1",
        name: "New Domain",
      })
    })

    it("should pass all fields to repository", async () => {
      const repo = createMockRepository({
        create: vi.fn().mockResolvedValue({ id: "new-domain" }),
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
      })
      const deps = { repo }

      await createStudyDomain(deps, "user-1", {
        name: "New Domain",
        description: "Description",
        emoji: "🎯",
        color: "red",
      })

      expect(repo.create).toHaveBeenCalledWith({
        userId: "user-1",
        name: "New Domain",
        description: "Description",
        emoji: "🎯",
        color: "red",
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

      const result = await updateStudyDomain(deps, "domain-1", "user-1", { name: "Updated Name" })

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.name).toBe("Updated Name")
      expect(repo.update).toHaveBeenCalledWith("domain-1", "user-1", { name: "Updated Name" })
    })

    it("should return not_found error when domain does not exist", async () => {
      const repo = createMockRepository({
        update: vi.fn().mockResolvedValue(null),
      })
      const deps = { repo }

      const result = await updateStudyDomain(deps, "non-existent", "user-1", { name: "New Name" })

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
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

      const result = await updateStudyDomain(deps, "domain-1", "user-1", { name: "Updated" })

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
        softDelete: vi.fn().mockResolvedValue(true),
      })
      const deps = { repo }

      const result = await deleteStudyDomain(deps, "domain-1", "user-1")

      expect(result.ok).toBe(true)
      expect(repo.softDelete).toHaveBeenCalledWith("domain-1", "user-1")
    })

    it("should return not_found error when domain does not exist", async () => {
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(null),
      })
      const deps = { repo }

      const result = await deleteStudyDomain(deps, "non-existent", "user-1")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("NOT_FOUND")
      expect(repo.canDeleteStudyDomain).not.toHaveBeenCalled()
      expect(repo.softDelete).not.toHaveBeenCalled()
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

      const result = await deleteStudyDomain(deps, "domain-1", "user-1")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("CONFLICT")
      expect(repo.softDelete).not.toHaveBeenCalled()
    })

    it("should use default message when reason is not provided", async () => {
      const canDeleteResult: CanDeleteResult = {
        canDelete: false,
      }
      const repo = createMockRepository({
        findById: vi.fn().mockResolvedValue(mockStudyDomain),
        canDeleteStudyDomain: vi.fn().mockResolvedValue(canDeleteResult),
      })
      const deps = { repo }

      const result = await deleteStudyDomain(deps, "domain-1", "user-1")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("CONFLICT")
    })
  })
})
