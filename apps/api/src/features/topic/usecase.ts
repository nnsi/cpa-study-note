import type { TopicRepository, TopicFilterParams } from "./repository"

type TopicDeps = {
  repo: TopicRepository
}

// レスポンス用の型定義
type SubjectWithStats = {
  id: string
  name: string
  description: string | null
  displayOrder: number
  createdAt: string
  updatedAt: string
  categoryCount: number
  topicCount: number
}

type CategoryNode = {
  id: string
  subjectId: string
  parentId: string | null
  name: string
  depth: number
  displayOrder: number
  createdAt: string
  updatedAt: string
  topicCount: number
  understoodCount: number
  children: CategoryNode[]
}

type TopicWithProgress = {
  id: string
  categoryId: string
  categoryName: string
  subjectId: string
  subjectName: string
  name: string
  description: string | null
  displayOrder: number
  createdAt: string
  updatedAt: string
  progress: {
    userId: string
    topicId: string
    understood: boolean
    lastAccessedAt: string | null
    createdAt: string
    updatedAt: string
  } | null
}

type ProgressResponse = {
  userId: string
  topicId: string
  understood: boolean
  lastAccessedAt: string | null
  createdAt: string
  updatedAt: string
}

// 科目一覧取得
export const listSubjects = async (
  deps: TopicDeps
): Promise<SubjectWithStats[]> => {
  const { repo } = deps
  const subjects = await repo.findAllSubjects()

  const subjectsWithStats = await Promise.all(
    subjects.map(async (subject) => {
      const stats = await repo.getSubjectStats(subject.id)
      return {
        ...subject,
        createdAt: subject.createdAt.toISOString(),
        updatedAt: subject.updatedAt.toISOString(),
        categoryCount: stats.categoryCount,
        topicCount: stats.topicCount,
      }
    })
  )

  return subjectsWithStats
}

// 科目詳細取得
export const getSubject = async (
  deps: TopicDeps,
  subjectId: string
): Promise<SubjectWithStats | null> => {
  const { repo } = deps
  const subject = await repo.findSubjectById(subjectId)

  if (!subject) {
    return null
  }

  const stats = await repo.getSubjectStats(subjectId)

  return {
    ...subject,
    createdAt: subject.createdAt.toISOString(),
    updatedAt: subject.updatedAt.toISOString(),
    categoryCount: stats.categoryCount,
    topicCount: stats.topicCount,
  }
}

// カテゴリ一覧（階層構造）取得
export const listCategoriesHierarchy = async (
  deps: TopicDeps,
  subjectId: string,
  userId?: string
): Promise<CategoryNode[]> => {
  const { repo } = deps
  const [categories, topicCounts, progressCounts] = await Promise.all([
    repo.findCategoriesBySubjectId(subjectId),
    repo.getCategoryTopicCounts(subjectId),
    userId ? repo.getProgressCountsByCategory(userId, subjectId) : [],
  ])

  // カテゴリIDごとの論点数マップ
  const topicCountMap = new Map(
    topicCounts.map((tc) => [tc.categoryId, tc.topicCount])
  )

  // カテゴリIDごとの理解済み数マップ
  const progressCountMap = new Map(
    progressCounts.map((pc) => [pc.categoryId, pc.understoodCount])
  )

  // 階層構造に変換
  const categoryMap = new Map<string, CategoryNode>()
  const rootCategories: CategoryNode[] = []

  // 1パス目：全カテゴリをマップに格納
  for (const cat of categories) {
    categoryMap.set(cat.id, {
      ...cat,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
      topicCount: topicCountMap.get(cat.id) ?? 0,
      understoodCount: progressCountMap.get(cat.id) ?? 0,
      children: [],
    })
  }

  // 2パス目：親子関係を構築
  for (const cat of categories) {
    const node = categoryMap.get(cat.id)!
    if (cat.parentId) {
      const parent = categoryMap.get(cat.parentId)
      if (parent) {
        parent.children.push(node)
      }
    } else {
      rootCategories.push(node)
    }
  }

  return rootCategories
}

// カテゴリの論点一覧取得
export const listTopicsByCategory = async (
  deps: TopicDeps,
  categoryId: string
): Promise<
  {
    id: string
    categoryId: string
    name: string
    description: string | null
    displayOrder: number
    createdAt: string
    updatedAt: string
  }[]
> => {
  const { repo } = deps
  const topics = await repo.findTopicsByCategoryId(categoryId)

  return topics.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))
}

// 論点詳細取得（進捗含む）
export const getTopicWithProgress = async (
  deps: TopicDeps,
  userId: string,
  topicId: string
): Promise<TopicWithProgress | null> => {
  const { repo } = deps
  const topic = await repo.findTopicWithHierarchy(topicId)

  if (!topic) {
    return null
  }

  const progress = await repo.findProgress(userId, topicId)

  // アクセス記録を更新
  await repo.upsertProgress({ userId, topicId })

  return {
    id: topic.id,
    categoryId: topic.categoryId,
    categoryName: topic.categoryName,
    subjectId: topic.subjectId,
    subjectName: topic.subjectName,
    name: topic.name,
    description: topic.description,
    displayOrder: topic.displayOrder,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
    progress: progress
      ? {
          ...progress,
          lastAccessedAt: progress.lastAccessedAt?.toISOString() ?? null,
          createdAt: progress.createdAt.toISOString(),
          updatedAt: progress.updatedAt.toISOString(),
        }
      : null,
  }
}

// 進捗更新
export const updateProgress = async (
  deps: TopicDeps,
  userId: string,
  topicId: string,
  understood?: boolean
): Promise<ProgressResponse> => {
  const { repo } = deps

  // 現在の進捗を取得して、understood が変更されたかチェック
  const currentProgress = await repo.findProgress(userId, topicId)
  const previousUnderstood = currentProgress?.understood ?? false

  const progress = await repo.upsertProgress({
    userId,
    topicId,
    understood,
  })

  // understood フラグが変更された場合は履歴を記録
  if (understood !== undefined && understood !== previousUnderstood) {
    await repo.createCheckHistory({
      userId,
      topicId,
      action: understood ? "checked" : "unchecked",
    })
  }

  return {
    ...progress,
    lastAccessedAt: progress.lastAccessedAt?.toISOString() ?? null,
    createdAt: progress.createdAt.toISOString(),
    updatedAt: progress.updatedAt.toISOString(),
  }
}

// ユーザーの全進捗取得
export const listUserProgress = async (
  deps: TopicDeps,
  userId: string
): Promise<ProgressResponse[]> => {
  const { repo } = deps
  const progressList = await repo.findProgressByUser(userId)

  return progressList.map((p) => ({
    ...p,
    lastAccessedAt: p.lastAccessedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))
}

// チェック履歴レスポンス型
type CheckHistoryResponse = {
  id: string
  action: "checked" | "unchecked"
  checkedAt: string
}

// チェック履歴取得
export const getCheckHistory = async (
  deps: TopicDeps,
  userId: string,
  topicId: string
): Promise<CheckHistoryResponse[]> => {
  const { repo } = deps
  const history = await repo.findCheckHistoryByTopic(userId, topicId)

  return history.map((h) => ({
    id: h.id,
    action: h.action,
    checkedAt: h.checkedAt.toISOString(),
  }))
}

// 科目別進捗取得
type SubjectProgressStats = {
  subjectId: string
  subjectName: string
  totalTopics: number
  understoodTopics: number
}

export const getSubjectProgressStats = async (
  deps: TopicDeps,
  userId: string
): Promise<SubjectProgressStats[]> => {
  const { repo } = deps

  const [subjects, progressCounts] = await Promise.all([
    repo.findAllSubjects(),
    repo.getProgressCountsBySubject(userId),
  ])

  // 科目ごとのトピック数を取得
  const subjectStats = await Promise.all(
    subjects.map(async (subject) => {
      const stats = await repo.getSubjectStats(subject.id)
      return { subjectId: subject.id, topicCount: stats.topicCount }
    })
  )

  const topicCountMap = new Map(
    subjectStats.map((s) => [s.subjectId, s.topicCount])
  )

  const progressMap = new Map(
    progressCounts.map((p) => [p.subjectId, p.understoodCount])
  )

  return subjects.map((subject) => ({
    subjectId: subject.id,
    subjectName: subject.name,
    totalTopics: topicCountMap.get(subject.id) ?? 0,
    understoodTopics: progressMap.get(subject.id) ?? 0,
  }))
}

// 最近触った論点レスポンス型
type RecentTopicResponse = {
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
  categoryId: string
  lastAccessedAt: string
}

// 最近触った論点取得
export const listRecentTopics = async (
  deps: TopicDeps,
  userId: string,
  limit: number = 10
): Promise<RecentTopicResponse[]> => {
  const { repo } = deps
  const topics = await repo.findRecentTopics(userId, limit)

  return topics.map((t) => ({
    topicId: t.topicId,
    topicName: t.topicName,
    subjectId: t.subjectId,
    subjectName: t.subjectName,
    categoryId: t.categoryId,
    lastAccessedAt: t.lastAccessedAt.toISOString(),
  }))
}

// フィルタ済み論点レスポンス型
type FilteredTopicResponse = {
  id: string
  name: string
  categoryId: string
  subjectId: string
  subjectName: string
  sessionCount: number
  lastChatAt: string | null
  understood: boolean
  goodQuestionCount: number
}

// フィルタ済み論点取得
export const filterTopics = async (
  deps: TopicDeps,
  userId: string,
  filters: TopicFilterParams
): Promise<FilteredTopicResponse[]> => {
  const { repo } = deps
  const topics = await repo.findFilteredTopics(userId, filters)

  return topics.map((t) => ({
    id: t.id,
    name: t.name,
    categoryId: t.categoryId,
    subjectId: t.subjectId,
    subjectName: t.subjectName,
    sessionCount: t.sessionCount,
    lastChatAt: t.lastChatAt ? new Date(t.lastChatAt).toISOString() : null,
    understood: Boolean(t.understood),
    goodQuestionCount: t.goodQuestionCount,
  }))
}
