import { DEFAULT_STUDY_DOMAIN_ID } from "@cpa-study/shared/constants"
import type {
  SubjectRepository,
  Subject,
  CreateSubjectInput,
  UpdateSubjectInput,
  BatchSubjectStats,
} from "./repository"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, type AppError } from "@/shared/lib/errors"
import type { Logger } from "@/shared/lib/logger"

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
  logger: Logger
}

type SubjectWithStats = Subject & {
  categoryCount: number
  topicCount: number
}

// UseCase functions
export const listSubjects = async (
  deps: SubjectDeps,
  userId: string,
  studyDomainId: string
): Promise<Result<SubjectWithStats[], AppError>> => {
  const { subjectRepo, logger } = deps
  // Verify the study domain belongs to the user
  const ownsStudyDomain = await subjectRepo.verifyStudyDomainOwnership(studyDomainId, userId)
  if (!ownsStudyDomain) {
    return err(notFound("学習領域が見つかりません"))
  }

  const subjects = await subjectRepo.findByStudyDomainId(studyDomainId, userId)

  // 統計情報を一括取得してマージ
  const subjectIds = subjects.map((s) => s.id)
  const stats = subjectIds.length > 0
    ? await subjectRepo.getBatchSubjectStats(subjectIds, userId)
    : []
  const statsMap = new Map(stats.map((s) => [s.subjectId, s]))

  const subjectsWithStats: SubjectWithStats[] = subjects.map((subject) => {
    const stat = statsMap.get(subject.id)
    return {
      ...subject,
      categoryCount: stat?.categoryCount ?? 0,
      topicCount: stat?.topicCount ?? 0,
    }
  })

  return ok(subjectsWithStats)
}

export const getSubject = async (
  deps: SubjectDeps,
  userId: string,
  subjectId: string
): Promise<Result<Subject, AppError>> => {
  const { subjectRepo, logger } = deps
  const subject = await subjectRepo.findById(subjectId, userId)
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
): Promise<Result<Subject, AppError>> => {
  const { subjectRepo, logger } = deps
  // Verify the study domain belongs to the user
  const ownsStudyDomain = await subjectRepo.verifyStudyDomainOwnership(data.studyDomainId, userId)
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

  const result = await subjectRepo.create(input)

  // Return full subject data
  const subject = await subjectRepo.findById(result.id, userId)
  if (!subject) {
    return err(notFound("作成した科目が見つかりません"))
  }
  return ok(subject)
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
  const { subjectRepo, logger } = deps
  const input: UpdateSubjectInput = {}
  if (data.name !== undefined) input.name = data.name
  if (data.description !== undefined) input.description = data.description
  if (data.emoji !== undefined) input.emoji = data.emoji
  if (data.color !== undefined) input.color = data.color
  if (data.displayOrder !== undefined) input.displayOrder = data.displayOrder

  const result = await subjectRepo.update(subjectId, userId, input)
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
  const { subjectRepo, logger } = deps
  const result = await subjectRepo.softDelete(subjectId, userId)
  if (!result) {
    return err(notFound("科目が見つかりません"))
  }
  return ok(undefined)
}
