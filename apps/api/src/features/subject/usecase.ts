import type { SubjectRepository, Subject, CreateSubjectInput, UpdateSubjectInput } from "./repository"

// Result type for operations
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

// Error types
export type SubjectUseCaseError = "NOT_FOUND" | "FORBIDDEN" | "HAS_CATEGORIES"

// Dependencies
export type SubjectUseCaseDeps = {
  subjectRepo: SubjectRepository
}

// UseCase functions
export const listSubjects = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  studyDomainId: string
): Promise<Result<Subject[], SubjectUseCaseError>> => {
  // Verify the study domain belongs to the user
  const ownsStudyDomain = await deps.subjectRepo.verifyStudyDomainOwnership(studyDomainId, userId)
  if (!ownsStudyDomain) {
    return err("NOT_FOUND")
  }

  const subjects = await deps.subjectRepo.findByStudyDomainId(studyDomainId, userId)
  return ok(subjects)
}

export const getSubject = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  subjectId: string
): Promise<Result<Subject, SubjectUseCaseError>> => {
  const subject = await deps.subjectRepo.findById(subjectId, userId)
  if (!subject) {
    return err("NOT_FOUND")
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
  deps: SubjectUseCaseDeps,
  userId: string,
  data: CreateSubjectData
): Promise<Result<{ id: string }, SubjectUseCaseError>> => {
  // Verify the study domain belongs to the user
  const ownsStudyDomain = await deps.subjectRepo.verifyStudyDomainOwnership(data.studyDomainId, userId)
  if (!ownsStudyDomain) {
    return err("NOT_FOUND")
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
  deps: SubjectUseCaseDeps,
  userId: string,
  subjectId: string,
  data: UpdateSubjectData
): Promise<Result<Subject, SubjectUseCaseError>> => {
  const input: UpdateSubjectInput = {}
  if (data.name !== undefined) input.name = data.name
  if (data.description !== undefined) input.description = data.description
  if (data.emoji !== undefined) input.emoji = data.emoji
  if (data.color !== undefined) input.color = data.color
  if (data.displayOrder !== undefined) input.displayOrder = data.displayOrder

  const result = await deps.subjectRepo.update(subjectId, userId, input)
  if (!result) {
    return err("NOT_FOUND")
  }
  return ok(result)
}

export const deleteSubject = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  subjectId: string
): Promise<Result<void, SubjectUseCaseError>> => {
  // Check if deletion is allowed
  const canDelete = await deps.subjectRepo.canDeleteSubject(subjectId, userId)
  if (!canDelete.canDelete) {
    return err("HAS_CATEGORIES")
  }

  const result = await deps.subjectRepo.softDelete(subjectId, userId)
  if (!result) {
    return err("NOT_FOUND")
  }
  return ok(undefined)
}
