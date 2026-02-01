import type {
  StudyDomainRepository,
  CreateStudyDomainInput,
  UpdateStudyDomainInput,
} from "./repository"

type StudyDomainDeps = {
  repo: StudyDomainRepository
}

// Result type for error handling
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

// Error types
type NotFoundError = { type: "not_found"; message: string }
type AlreadyExistsError = { type: "already_exists"; message: string }
type CannotDeleteError = { type: "cannot_delete"; message: string }
type NotJoinedError = { type: "not_joined"; message: string }

// Response types
type StudyDomainResponse = {
  id: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

type UserStudyDomainResponse = {
  id: string
  userId: string
  studyDomainId: string
  joinedAt: string
  studyDomain: StudyDomainResponse
}

// List all public study domains
export const listPublicStudyDomains = async (
  deps: StudyDomainDeps
): Promise<StudyDomainResponse[]> => {
  const { repo } = deps
  const domains = await repo.findAllPublic()

  return domains.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }))
}

// Get study domain by ID
export const getStudyDomain = async (
  deps: StudyDomainDeps,
  id: string
): Promise<Result<StudyDomainResponse, NotFoundError>> => {
  const { repo } = deps
  const domain = await repo.findById(id)

  if (!domain) {
    return err({ type: "not_found", message: "学習領域が見つかりません" })
  }

  return ok({
    ...domain,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  })
}

// Create study domain
export const createStudyDomain = async (
  deps: StudyDomainDeps,
  data: CreateStudyDomainInput
): Promise<Result<StudyDomainResponse, AlreadyExistsError>> => {
  const { repo } = deps

  // Check if ID already exists
  const existing = await repo.findById(data.id)
  if (existing) {
    return err({ type: "already_exists", message: "このIDの学習領域は既に存在します" })
  }

  const domain = await repo.create(data)

  return ok({
    ...domain,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  })
}

// Update study domain
export const updateStudyDomain = async (
  deps: StudyDomainDeps,
  id: string,
  data: UpdateStudyDomainInput
): Promise<Result<StudyDomainResponse, NotFoundError>> => {
  const { repo } = deps
  const domain = await repo.update(id, data)

  if (!domain) {
    return err({ type: "not_found", message: "学習領域が見つかりません" })
  }

  return ok({
    ...domain,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  })
}

// Delete study domain
export const deleteStudyDomain = async (
  deps: StudyDomainDeps,
  id: string
): Promise<Result<void, NotFoundError | CannotDeleteError>> => {
  const { repo } = deps

  // Check if domain exists
  const existing = await repo.findById(id)
  if (!existing) {
    return err({ type: "not_found", message: "学習領域が見つかりません" })
  }

  // Check if can delete
  const canDelete = await repo.canDeleteStudyDomain(id)
  if (!canDelete.canDelete) {
    return err({
      type: "cannot_delete",
      message: canDelete.reason ?? "この学習領域は削除できません",
    })
  }

  await repo.remove(id)
  return ok(undefined)
}

// List user's joined study domains
export const listUserStudyDomains = async (
  deps: StudyDomainDeps,
  userId: string
): Promise<UserStudyDomainResponse[]> => {
  const { repo } = deps
  const userDomains = await repo.findByUserId(userId)

  return userDomains.map((ud) => ({
    id: ud.id,
    userId: ud.userId,
    studyDomainId: ud.studyDomainId,
    joinedAt: ud.joinedAt.toISOString(),
    studyDomain: {
      ...ud.studyDomain,
      createdAt: ud.studyDomain.createdAt.toISOString(),
      updatedAt: ud.studyDomain.updatedAt.toISOString(),
    },
  }))
}

// Join a study domain
export const joinStudyDomain = async (
  deps: StudyDomainDeps,
  userId: string,
  studyDomainId: string
): Promise<Result<UserStudyDomainResponse, NotFoundError | AlreadyExistsError>> => {
  const { repo } = deps

  // Check if domain exists
  const domain = await repo.findById(studyDomainId)
  if (!domain) {
    return err({ type: "not_found", message: "学習領域が見つかりません" })
  }

  // Check if already joined
  const existing = await repo.findUserStudyDomain(userId, studyDomainId)
  if (existing) {
    return err({ type: "already_exists", message: "既にこの学習領域に参加しています" })
  }

  // Try to join, catching UNIQUE constraint violation (race condition defense)
  try {
    const userDomain = await repo.joinDomain(userId, studyDomainId)

    return ok({
      id: userDomain.id,
      userId: userDomain.userId,
      studyDomainId: userDomain.studyDomainId,
      joinedAt: userDomain.joinedAt.toISOString(),
      studyDomain: {
        ...domain,
        createdAt: domain.createdAt.toISOString(),
        updatedAt: domain.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    // Handle UNIQUE constraint violation (concurrent join attempt)
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return err({ type: "already_exists", message: "既にこの学習領域に参加しています" })
    }
    throw error
  }
}

// Leave a study domain
// Only removes user_study_domains record, keeps learning history per design doc "痕跡を残す" principle
export const leaveStudyDomain = async (
  deps: StudyDomainDeps,
  userId: string,
  studyDomainId: string
): Promise<Result<void, NotFoundError | NotJoinedError>> => {
  const { repo } = deps

  // Check if domain exists
  const domain = await repo.findById(studyDomainId)
  if (!domain) {
    return err({ type: "not_found", message: "学習領域が見つかりません" })
  }

  // Check if user has joined
  const existing = await repo.findUserStudyDomain(userId, studyDomainId)
  if (!existing) {
    return err({ type: "not_joined", message: "この学習領域には参加していません" })
  }

  // Clear user's defaultStudyDomainId if it matches the domain being left
  await repo.clearUserDefaultDomainIfMatches(userId, studyDomainId)

  await repo.leaveDomain(userId, studyDomainId)
  return ok(undefined)
}
