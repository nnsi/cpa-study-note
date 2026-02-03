import type {
  StudyDomainRepository,
  CreateStudyDomainInput,
  UpdateStudyDomainInput,
} from "./repository"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, conflict, type AppError } from "@/shared/lib/errors"

type StudyDomainDeps = {
  repo: StudyDomainRepository
}

// Response types
type StudyDomainResponse = {
  id: string
  userId: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  createdAt: string
  updatedAt: string
}

// List user's study domains
export const listStudyDomains = async (
  deps: StudyDomainDeps,
  userId: string
): Promise<Result<StudyDomainResponse[], AppError>> => {
  const { repo } = deps
  const domains = await repo.findByUserId(userId)

  return ok(
    domains.map((d) => ({
      id: d.id,
      userId: d.userId,
      name: d.name,
      description: d.description,
      emoji: d.emoji,
      color: d.color,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }))
  )
}

// Get study domain by ID
export const getStudyDomain = async (
  deps: StudyDomainDeps,
  id: string,
  userId: string
): Promise<Result<StudyDomainResponse, AppError>> => {
  const { repo } = deps
  const domain = await repo.findById(id, userId)

  if (!domain) {
    return err(notFound("学習領域が見つかりません"))
  }

  return ok({
    id: domain.id,
    userId: domain.userId,
    name: domain.name,
    description: domain.description,
    emoji: domain.emoji,
    color: domain.color,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  })
}

// Create study domain
export const createStudyDomain = async (
  deps: StudyDomainDeps,
  userId: string,
  data: Omit<CreateStudyDomainInput, "userId">
): Promise<Result<StudyDomainResponse, AppError>> => {
  const { repo } = deps

  const { id } = await repo.create({
    userId,
    ...data,
  })

  // Fetch the created domain to return
  const domain = await repo.findById(id, userId)
  if (!domain) {
    return err(notFound("学習領域の作成に失敗しました"))
  }

  return ok({
    id: domain.id,
    userId: domain.userId,
    name: domain.name,
    description: domain.description,
    emoji: domain.emoji,
    color: domain.color,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  })
}

// Update study domain
export const updateStudyDomain = async (
  deps: StudyDomainDeps,
  id: string,
  userId: string,
  data: UpdateStudyDomainInput
): Promise<Result<StudyDomainResponse, AppError>> => {
  const { repo } = deps
  const domain = await repo.update(id, userId, data)

  if (!domain) {
    return err(notFound("学習領域が見つかりません"))
  }

  return ok({
    id: domain.id,
    userId: domain.userId,
    name: domain.name,
    description: domain.description,
    emoji: domain.emoji,
    color: domain.color,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  })
}

// Delete study domain (soft delete)
export const deleteStudyDomain = async (
  deps: StudyDomainDeps,
  id: string,
  userId: string
): Promise<Result<void, AppError>> => {
  const { repo } = deps

  // Check if domain exists and belongs to user
  const existing = await repo.findById(id, userId)
  if (!existing) {
    return err(notFound("学習領域が見つかりません"))
  }

  // Check if can delete (no subjects)
  const canDelete = await repo.canDeleteStudyDomain(id, userId)
  if (!canDelete.canDelete) {
    return err(conflict(canDelete.reason ?? "この学習領域は削除できません", { reason: "HAS_SUBJECTS" }))
  }

  await repo.softDelete(id, userId)
  return ok(undefined)
}
