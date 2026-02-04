import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, type AppError } from "@/shared/lib/errors"
import type { TopicViewRepo, TopicViewData } from "./repositories/topicViewRepo"
import type { SubjectDashboardViewRepo, SubjectDashboardData } from "./repositories/subjectDashboardViewRepo"
import type { ReviewListViewRepo, ReviewListData, ReviewListFilters } from "./repositories/reviewListViewRepo"
import type { CategoryTopicsViewRepo, CategoryTopicsData } from "./repositories/categoryTopicsViewRepo"
import type { SearchViewRepo, TopicSearchResult } from "./repositories/searchViewRepo"

// Response types (Date -> string conversion)
export type TopicViewResponse = {
  topic: {
    id: string
    name: string
    description: string | null
    categoryId: string
    categoryName: string
    subjectId: string
    subjectName: string
    difficulty: string | null
    topicType: string | null
    displayOrder: number
    createdAt: string
    updatedAt: string
  }
  progress: {
    id: string
    userId: string
    topicId: string
    understood: boolean
    lastAccessedAt: string | null
    questionCount: number
    goodQuestionCount: number
    createdAt: string
    updatedAt: string
  } | null
  recentNotes: Array<{
    id: string
    title: string | null
    updatedAt: string
  }>
  recentSessions: Array<{
    id: string
    createdAt: string
  }>
}

export type SubjectDashboardResponse = {
  subject: {
    id: string
    name: string
    emoji: string | null
    color: string | null
  }
  stats: {
    categoryCount: number
    topicCount: number
    completedCount: number
    progressPercentage: number
  }
  recentTopics: Array<{
    id: string
    name: string
    lastAccessedAt: string | null
  }>
}

export type ReviewListResponse = {
  topics: Array<{
    id: string
    name: string
    subjectId: string
    subjectName: string
    categoryId: string
    understood: boolean
    lastAccessedAt: string | null
    sessionCount: number
  }>
  total: number
}

export type CategoryTopicsResponse = {
  category: {
    id: string
    name: string
  }
  topics: Array<{
    id: string
    name: string
    description: string | null
    displayOrder: number
  }>
}

export type SearchTopicsResponse = {
  results: TopicSearchResult[]
  total: number
}

// Dependencies
export type ViewDeps = {
  topicViewRepo: TopicViewRepo
  subjectDashboardViewRepo: SubjectDashboardViewRepo
  reviewListViewRepo: ReviewListViewRepo
  categoryTopicsViewRepo?: CategoryTopicsViewRepo
  searchViewRepo?: SearchViewRepo
}

/**
 * Get topic view data for the topic detail screen
 */
export const getTopicView = async (
  deps: ViewDeps,
  userId: string,
  topicId: string
): Promise<Result<TopicViewResponse, AppError>> => {
  const data = await deps.topicViewRepo.getTopicView(topicId, userId)

  if (!data) {
    return err(notFound("論点が見つかりません"))
  }

  return ok(formatTopicView(data))
}

/**
 * Get subject dashboard data
 */
export const getSubjectDashboard = async (
  deps: ViewDeps,
  userId: string,
  subjectId: string
): Promise<Result<SubjectDashboardResponse, AppError>> => {
  const data = await deps.subjectDashboardViewRepo.getSubjectDashboard(subjectId, userId)

  if (!data) {
    return err(notFound("科目が見つかりません"))
  }

  return ok(formatSubjectDashboard(data))
}

/**
 * Get review list data
 */
export const getReviewList = async (
  deps: ViewDeps,
  userId: string,
  filters?: ReviewListFilters
): Promise<Result<ReviewListResponse, AppError>> => {
  const data = await deps.reviewListViewRepo.getReviewList(userId, filters)

  return ok(formatReviewList(data))
}

/**
 * Get topics for a category
 */
export const getCategoryTopics = async (
  deps: ViewDeps,
  userId: string,
  categoryId: string
): Promise<Result<CategoryTopicsResponse, AppError>> => {
  if (!deps.categoryTopicsViewRepo) {
    return err(notFound("CategoryTopicsViewRepo not configured"))
  }

  const data = await deps.categoryTopicsViewRepo.getCategoryTopics(categoryId, userId)

  if (!data) {
    return err(notFound("単元が見つかりません"))
  }

  return ok(formatCategoryTopics(data))
}

/**
 * Search topics
 */
export const searchTopics = async (
  deps: ViewDeps,
  userId: string,
  query: string,
  studyDomainId?: string,
  limit?: number
): Promise<Result<SearchTopicsResponse, AppError>> => {
  if (!deps.searchViewRepo) {
    return err(notFound("SearchViewRepo not configured"))
  }

  const data = await deps.searchViewRepo.searchTopics(userId, query, studyDomainId, limit)

  return ok(data)
}

// Formatters (Date -> string conversion)

const formatTopicView = (data: TopicViewData): TopicViewResponse => ({
  topic: {
    ...data.topic,
    createdAt: data.topic.createdAt.toISOString(),
    updatedAt: data.topic.updatedAt.toISOString(),
  },
  progress: data.progress
    ? {
        ...data.progress,
        lastAccessedAt: data.progress.lastAccessedAt?.toISOString() ?? null,
        createdAt: data.progress.createdAt.toISOString(),
        updatedAt: data.progress.updatedAt.toISOString(),
      }
    : null,
  recentNotes: data.recentNotes.map((n) => ({
    ...n,
    updatedAt: n.updatedAt.toISOString(),
  })),
  recentSessions: data.recentSessions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
  })),
})

const formatSubjectDashboard = (data: SubjectDashboardData): SubjectDashboardResponse => ({
  subject: data.subject,
  stats: data.stats,
  recentTopics: data.recentTopics.map((t) => ({
    ...t,
    lastAccessedAt: t.lastAccessedAt?.toISOString() ?? null,
  })),
})

const formatReviewList = (data: ReviewListData): ReviewListResponse => ({
  topics: data.topics.map((t) => ({
    ...t,
    lastAccessedAt: t.lastAccessedAt?.toISOString() ?? null,
  })),
  total: data.total,
})

const formatCategoryTopics = (data: CategoryTopicsData): CategoryTopicsResponse => ({
  category: data.category,
  topics: data.topics,
})
