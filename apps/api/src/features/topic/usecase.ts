import type { TopicRepository } from "./repository"

type TopicDeps = {
  repo: TopicRepository
}

// レスポンス用の型定義
type SubjectWithStats = {
  id: string
  name: string
  slug: string
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
  children: CategoryNode[]
}

type TopicWithProgress = {
  id: string
  categoryId: string
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
  subjectId: string
): Promise<CategoryNode[]> => {
  const { repo } = deps
  const categories = await repo.findCategoriesBySubjectId(subjectId)

  // 階層構造に変換
  const categoryMap = new Map<string, CategoryNode>()
  const rootCategories: CategoryNode[] = []

  // 1パス目：全カテゴリをマップに格納
  for (const cat of categories) {
    categoryMap.set(cat.id, {
      ...cat,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
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
  const topic = await repo.findTopicById(topicId)

  if (!topic) {
    return null
  }

  const progress = await repo.findProgress(userId, topicId)

  // アクセス記録を更新
  await repo.upsertProgress({ userId, topicId })

  return {
    ...topic,
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
  const progress = await repo.upsertProgress({
    userId,
    topicId,
    understood,
  })

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
