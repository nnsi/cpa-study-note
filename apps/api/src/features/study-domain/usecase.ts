import type {
  StudyDomainRepository,
  CreateStudyDomainInput,
  UpdateStudyDomainInput,
} from "./repository"
import type { StudyDomainResponse } from "@cpa-study/shared/schemas"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, type AppError } from "@/shared/lib/errors"

type StudyDomainDeps = {
  repo: StudyDomainRepository
}

// List user's study domains
export const listStudyDomains = async (
  deps: StudyDomainDeps,
  userId: string
): Promise<Result<StudyDomainResponse[], AppError>> => {
  const repo = deps.repo
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
  const repo = deps.repo
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
  const repo = deps.repo

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
  const repo = deps.repo
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

// Delete study domain (soft delete with cascade)
export const deleteStudyDomain = async (
  deps: StudyDomainDeps,
  id: string,
  userId: string
): Promise<Result<void, AppError>> => {
  const repo = deps.repo

  // Check if domain exists and belongs to user
  const existing = await repo.findById(id, userId)
  if (!existing) {
    return err(notFound("学習領域が見つかりません"))
  }

  await repo.softDelete(id, userId)
  return ok(undefined)
}
