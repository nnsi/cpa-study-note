import { DEFAULT_STUDY_DOMAIN_ID } from "@cpa-study/shared/constants"
import type {
  SubjectRepository,
  Subject,
  CreateSubjectInput,
  UpdateSubjectInput,
} from "./repository"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, conflict, type AppError } from "@/shared/lib/errors"

// User type for resolving studyDomainId
type User = {
  id: string
  defaultStudyDomainId: string | null
}

// studyDomainId を解決する
export const resolveStudyDomainId = (
  explicitId: string | undefined,
  user: User | undefined
): string => {
  if (explicitId) return explicitId
  if (user?.defaultStudyDomainId) return user.defaultStudyDomainId
  return DEFAULT_STUDY_DOMAIN_ID
}

// Dependencies
export type SubjectDeps = {
  subjectRepo: SubjectRepository
}

// UseCase functions
export const listSubjects = async (
  deps: SubjectDeps,
  userId: string,
  studyDomainId: string
): Promise<Result<Subject[], AppError>> => {
  // Verify the study domain belongs to the user
  const ownsStudyDomain = await deps.subjectRepo.verifyStudyDomainOwnership(studyDomainId, userId)
  if (!ownsStudyDomain) {
    return err(notFound("学習領域が見つかりません"))
  }

  const subjects = await deps.subjectRepo.findByStudyDomainId(studyDomainId, userId)
  return ok(subjects)
}

export const getSubject = async (
  deps: SubjectDeps,
  userId: string,
  subjectId: string
): Promise<Result<Subject, AppError>> => {
  const subject = await deps.subjectRepo.findById(subjectId, userId)
  if (!subject) {
    return err(notFound("科目が見つかりません"))
  }
  return ok(subject)
}

export type CreateSubjectData = {
  studyDomainId: string
  name: string
  description?: string | null
  emoji?: string | null
  color?: string | null
  displayOrder?: number
}

export const createSubject = async (
  deps: SubjectDeps,
  userId: string,
  data: CreateSubjectData
): Promise<Result<{ id: string }, AppError>> => {
  // Verify the study domain belongs to the user
  const ownsStudyDomain = await deps.subjectRepo.verifyStudyDomainOwnership(data.studyDomainId, userId)
  if (!ownsStudyDomain) {
    return err(notFound("学習領域が見つかりません"))
  }

  const input: CreateSubjectInput = {
    userId,
    studyDomainId: data.studyDomainId,
    name: data.name,
    description: data.description,
    emoji: data.emoji,
    color: data.color,
    displayOrder: data.displayOrder,
  }

  const result = await deps.subjectRepo.create(input)
  return ok(result)
}

export type UpdateSubjectData = {
  name?: string
  description?: string | null
  emoji?: string | null
  color?: string | null
  displayOrder?: number
}

export const updateSubject = async (
  deps: SubjectDeps,
  userId: string,
  subjectId: string,
  data: UpdateSubjectData
): Promise<Result<Subject, AppError>> => {
  const input: UpdateSubjectInput = {}
  if (data.name !== undefined) input.name = data.name
  if (data.description !== undefined) input.description = data.description
  if (data.emoji !== undefined) input.emoji = data.emoji
  if (data.color !== undefined) input.color = data.color
  if (data.displayOrder !== undefined) input.displayOrder = data.displayOrder

  const result = await deps.subjectRepo.update(subjectId, userId, input)
  if (!result) {
    return err(notFound("科目が見つかりません"))
  }
  return ok(result)
}

export const deleteSubject = async (
  deps: SubjectDeps,
  userId: string,
  subjectId: string
): Promise<Result<void, AppError>> => {
  // Check if deletion is allowed
  const canDelete = await deps.subjectRepo.canDeleteSubject(subjectId, userId)
  if (!canDelete.canDelete) {
    return err(conflict("単元が紐づいているため削除できません", { reason: "HAS_CATEGORIES" }))
  }

  const result = await deps.subjectRepo.softDelete(subjectId, userId)
  if (!result) {
    return err(notFound("科目が見つかりません"))
  }
  return ok(undefined)
}
