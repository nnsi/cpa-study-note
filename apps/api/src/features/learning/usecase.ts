import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, type AppError } from "@/shared/lib/errors"
import type { LearningRepository, TopicProgress } from "./repository"
import type { SubjectRepository } from "../subject/repository"
import type { Logger } from "@/shared/lib/logger"
import type { Tracer } from "@/shared/lib/tracer"
import type {
  ProgressResponse,
  SubjectProgressStats,
  TopicCheckHistoryResponse,
  RecentTopic,
} from "@cpa-study/shared/schemas"

// Dependencies
export type LearningDeps = {
  learningRepo: LearningRepository
  logger: Logger
  tracer: Tracer
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
  deps: LearningDeps,
  userId: string,
  topicId: string
): Promise<Result<ProgressResponse, AppError>> => {
  const { learningRepo, logger, tracer } = deps
  // Verify topic exists and belongs to user
  const exists = await tracer.span("d1.verifyTopicExists", () =>
    learningRepo.verifyTopicExists(userId, topicId)
  )
  if (!exists) {
    return err(notFound("論点が見つかりません"))
  }

  const progress = await tracer.span("d1.touchTopic", () =>
    learningRepo.touchTopic(userId, topicId)
  )
  return ok(formatProgress(progress))
}

/**
 * Get progress for a topic
 */
export const getProgress = async (
  deps: LearningDeps,
  userId: string,
  topicId: string
): Promise<Result<ProgressResponse | null, AppError>> => {
  const { learningRepo, logger, tracer } = deps
  // Verify topic exists and belongs to user
  const exists = await tracer.span("d1.verifyTopicExists", () =>
    learningRepo.verifyTopicExists(userId, topicId)
  )
  if (!exists) {
    return err(notFound("論点が見つかりません"))
  }

  const progress = await tracer.span("d1.findProgress", () =>
    learningRepo.findProgress(userId, topicId)
  )
  return ok(progress ? formatProgress(progress) : null)
}

/**
 * Update progress for a topic
 */
export const updateProgress = async (
  deps: LearningDeps,
  userId: string,
  topicId: string,
  understood?: boolean
): Promise<Result<ProgressResponse, AppError>> => {
  const { learningRepo, logger, tracer } = deps
  // Verify topic exists and belongs to user
  const exists = await tracer.span("d1.verifyTopicExists", () =>
    learningRepo.verifyTopicExists(userId, topicId)
  )
  if (!exists) {
    return err(notFound("論点が見つかりません"))
  }

  // Get current progress to check if understood changed
  const currentProgress = await tracer.span("d1.findProgress", () =>
    learningRepo.findProgress(userId, topicId)
  )
  const previousUnderstood = currentProgress?.understood ?? false

  const progress = await tracer.span("d1.upsertProgress", () =>
    learningRepo.upsertProgress(userId, {
      userId,
      topicId,
      understood,
    })
  )

  // Record check history if understood flag changed
  if (understood !== undefined && understood !== previousUnderstood) {
    await tracer.span("d1.createCheckHistory", () =>
      learningRepo.createCheckHistory(userId, {
        userId,
        topicId,
        action: understood ? "checked" : "unchecked",
      })
    )
  }

  return ok(formatProgress(progress))
}

/**
 * List all progress for a user
 */
export const listUserProgress = async (
  deps: LearningDeps,
  userId: string
): Promise<Result<ProgressResponse[], AppError>> => {
  const { learningRepo, logger, tracer } = deps
  const progressList = await tracer.span("d1.findProgressByUser", () =>
    learningRepo.findProgressByUser(userId)
  )
  return ok(progressList.map(formatProgress))
}

/**
 * Get check history for a topic
 */
export const getCheckHistory = async (
  deps: LearningDeps,
  userId: string,
  topicId: string
): Promise<Result<TopicCheckHistoryResponse[], AppError>> => {
  const { learningRepo, logger, tracer } = deps
  // Verify topic exists and belongs to user
  const exists = await tracer.span("d1.verifyTopicExists", () =>
    learningRepo.verifyTopicExists(userId, topicId)
  )
  if (!exists) {
    return err(notFound("論点が見つかりません"))
  }

  const history = await tracer.span("d1.findCheckHistory", () =>
    learningRepo.findCheckHistoryByTopic(userId, topicId)
  )

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
  deps: LearningDeps,
  userId: string,
  limit: number = 10
): Promise<Result<RecentTopic[], AppError>> => {
  const { learningRepo, logger, tracer } = deps
  const topics = await tracer.span("d1.findRecentTopics", () =>
    learningRepo.findRecentTopics(userId, limit)
  )

  return ok(
    topics.map((t) => ({
      topicId: t.topicId,
      topicName: t.topicName,
      domainId: t.domainId,
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
  deps: { subjectRepo: SubjectRepository; logger: Logger; tracer: Tracer },
  userId: string
): Promise<Result<SubjectProgressStats[], AppError>> => {
  const { subjectRepo, logger, tracer } = deps
  const [subjects, progressCounts] = await tracer.span("d1.findSubjectsAndProgress", () =>
    Promise.all([
      subjectRepo.findAllSubjectsForUser(undefined, userId),
      subjectRepo.getProgressCountsBySubject(userId),
    ])
  )

  const subjectIds = subjects.map((s) => s.id)
  const batchStats = await tracer.span("d1.getBatchStats", () =>
    subjectRepo.getBatchSubjectStats(subjectIds, userId)
  )

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
