import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, type AppError } from "@/shared/lib/errors"
import type { LearningRepository, TopicProgress } from "./repository"
import type { SubjectRepository } from "../subject/repository"

// Response types
export type ProgressResponse = {
  userId: string
  topicId: string
  understood: boolean
  lastAccessedAt: string | null
  questionCount: number
  goodQuestionCount: number
  createdAt: string
  updatedAt: string
}

export type CheckHistoryResponse = {
  id: string
  action: "checked" | "unchecked"
  checkedAt: string
}

export type RecentTopicResponse = {
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
  categoryId: string
  lastAccessedAt: string
}

export type SubjectProgressStats = {
  subjectId: string
  subjectName: string
  totalTopics: number
  understoodTopics: number
}

// Dependencies
export type LearningUseCaseDeps = {
  learningRepo: LearningRepository
}

// Helper function to format progress
const formatProgress = (progress: TopicProgress): ProgressResponse => ({
  userId: progress.userId,
  topicId: progress.topicId,
  understood: progress.understood,
  lastAccessedAt: progress.lastAccessedAt?.toISOString() ?? null,
  questionCount: progress.questionCount,
  goodQuestionCount: progress.goodQuestionCount,
  createdAt: progress.createdAt.toISOString(),
  updatedAt: progress.updatedAt.toISOString(),
})

/**
 * Touch a topic to update lastAccessedAt
 */
export const touchTopic = async (
  deps: LearningUseCaseDeps,
  userId: string,
  topicId: string
): Promise<Result<ProgressResponse, AppError>> => {
  // Verify topic exists and belongs to user
  const exists = await deps.learningRepo.verifyTopicExists(userId, topicId)
  if (!exists) {
    return err(notFound("論点が見つかりません"))
  }

  const progress = await deps.learningRepo.touchTopic(userId, topicId)
  return ok(formatProgress(progress))
}

/**
 * Get progress for a topic
 */
export const getProgress = async (
  deps: LearningUseCaseDeps,
  userId: string,
  topicId: string
): Promise<Result<ProgressResponse | null, AppError>> => {
  // Verify topic exists and belongs to user
  const exists = await deps.learningRepo.verifyTopicExists(userId, topicId)
  if (!exists) {
    return err(notFound("論点が見つかりません"))
  }

  const progress = await deps.learningRepo.findProgress(userId, topicId)
  return ok(progress ? formatProgress(progress) : null)
}

/**
 * Update progress for a topic
 */
export const updateProgress = async (
  deps: LearningUseCaseDeps,
  userId: string,
  topicId: string,
  understood?: boolean
): Promise<Result<ProgressResponse, AppError>> => {
  // Verify topic exists and belongs to user
  const exists = await deps.learningRepo.verifyTopicExists(userId, topicId)
  if (!exists) {
    return err(notFound("論点が見つかりません"))
  }

  // Get current progress to check if understood changed
  const currentProgress = await deps.learningRepo.findProgress(userId, topicId)
  const previousUnderstood = currentProgress?.understood ?? false

  const progress = await deps.learningRepo.upsertProgress(userId, {
    userId,
    topicId,
    understood,
  })

  // Record check history if understood flag changed
  if (understood !== undefined && understood !== previousUnderstood) {
    await deps.learningRepo.createCheckHistory(userId, {
      userId,
      topicId,
      action: understood ? "checked" : "unchecked",
    })
  }

  return ok(formatProgress(progress))
}

/**
 * List all progress for a user
 */
export const listUserProgress = async (
  deps: LearningUseCaseDeps,
  userId: string
): Promise<Result<ProgressResponse[], AppError>> => {
  const progressList = await deps.learningRepo.findProgressByUser(userId)
  return ok(progressList.map(formatProgress))
}

/**
 * Get check history for a topic
 */
export const getCheckHistory = async (
  deps: LearningUseCaseDeps,
  userId: string,
  topicId: string
): Promise<Result<CheckHistoryResponse[], AppError>> => {
  // Verify topic exists and belongs to user
  const exists = await deps.learningRepo.verifyTopicExists(userId, topicId)
  if (!exists) {
    return err(notFound("論点が見つかりません"))
  }

  const history = await deps.learningRepo.findCheckHistoryByTopic(userId, topicId)

  return ok(
    history.map((h) => ({
      id: h.id,
      action: h.action,
      checkedAt: h.checkedAt.toISOString(),
    }))
  )
}

/**
 * List recent topics
 */
export const listRecentTopics = async (
  deps: LearningUseCaseDeps,
  userId: string,
  limit: number = 10
): Promise<Result<RecentTopicResponse[], AppError>> => {
  const topics = await deps.learningRepo.findRecentTopics(userId, limit)

  return ok(
    topics.map((t) => ({
      topicId: t.topicId,
      topicName: t.topicName,
      subjectId: t.subjectId,
      subjectName: t.subjectName,
      categoryId: t.categoryId,
      lastAccessedAt: t.lastAccessedAt.toISOString(),
    }))
  )
}

/**
 * Get subject progress stats
 */
export const getSubjectProgressStats = async (
  deps: { subjectRepo: SubjectRepository },
  userId: string
): Promise<Result<SubjectProgressStats[], AppError>> => {
  const [subjects, progressCounts] = await Promise.all([
    deps.subjectRepo.findAllSubjectsForUser(undefined, userId),
    deps.subjectRepo.getProgressCountsBySubject(userId),
  ])

  const subjectIds = subjects.map((s) => s.id)
  const batchStats = await deps.subjectRepo.getBatchSubjectStats(subjectIds, userId)

  const topicCountMap = new Map(batchStats.map((s) => [s.subjectId, s.topicCount]))
  const progressMap = new Map(progressCounts.map((p) => [p.subjectId, p.understoodCount]))

  return ok(
    subjects.map((subject) => ({
      subjectId: subject.id,
      subjectName: subject.name,
      totalTopics: topicCountMap.get(subject.id) ?? 0,
      understoodTopics: progressMap.get(subject.id) ?? 0,
    }))
  )
}
