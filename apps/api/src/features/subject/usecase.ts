import type { Db } from "@cpa-study/db"
import type {
  UpdateTreeRequest,
  TreeResponse,
  CategoryNodeResponse,
  SubcategoryNodeResponse,
  TopicNodeResponse,
  CSVImportResponse,
} from "@cpa-study/shared/schemas"
import { DEFAULT_STUDY_DOMAIN_ID } from "@cpa-study/shared/constants"
import type {
  SubjectRepository,
  Subject,
  CreateSubjectInput,
  UpdateSubjectInput,
  TopicProgress,
  TopicFilterParams,
  FilteredTopicRow,
  SearchTopicRow,
  RecentTopicRow,
  SubjectStats,
  CategoryTopicCount,
  CategoryProgressCount,
  SubjectProgressCount,
  TopicWithHierarchy,
  CategoryRecord,
} from "./repository"
import { parseCSV, parseCSV4Column, groupRowsBySubject, convertToTree, mergeTree } from "./csv-parser"
import type { SimpleTransactionRunner } from "../../shared/lib/transaction"

// Result type for operations
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

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

// レスポンス用の型定義
type SubjectWithStats = {
  id: string
  studyDomainId: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
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

type TopicWithProgressResponse = {
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
  progress: ProgressResponse | null
}

type ProgressResponse = {
  userId: string
  topicId: string
  understood: boolean
  lastAccessedAt: string | null
  createdAt: string
  updatedAt: string
}

type CheckHistoryResponse = {
  id: string
  action: "checked" | "unchecked"
  checkedAt: string
}

type SubjectProgressStats = {
  subjectId: string
  subjectName: string
  totalTopics: number
  understoodTopics: number
}

type RecentTopicResponse = {
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
  categoryId: string
  lastAccessedAt: string
}

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

type TopicResponse = {
  id: string
  categoryId: string
  name: string
  description: string | null
  displayOrder: number
  createdAt: string
  updatedAt: string
}

// Error types
export type SubjectUseCaseError = "NOT_FOUND" | "FORBIDDEN" | "HAS_CATEGORIES"
export type TreeOperationError = "NOT_FOUND" | "FORBIDDEN" | "INVALID_ID"
export type CSVImportError = "NOT_FOUND" | "FORBIDDEN"

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

// Tree operations dependencies
export type TreeUseCaseDeps = {
  subjectRepo: SubjectRepository
  db: Db
  txRunner?: SimpleTransactionRunner
}

/**
 * Get the tree structure for a subject
 */
export const getSubjectTree = async (
  deps: TreeUseCaseDeps,
  userId: string,
  subjectId: string
): Promise<Result<TreeResponse, TreeOperationError>> => {
  // 1. Verify subject ownership
  const subject = await deps.subjectRepo.findSubjectByIdAndUserId(subjectId, userId)
  if (!subject) {
    return err("NOT_FOUND")
  }

  // 2. Get all categories for this subject
  const allCategories = await deps.subjectRepo.findCategoriesBySubjectId(subjectId, userId)

  // 3. Get all topics for categories in this subject
  const categoryIds = allCategories.map((c) => c.id)
  const allTopics = await deps.subjectRepo.findTopicsByCategoryIds(categoryIds, userId)

  // 4. Build tree structure
  // Separate depth=1 (categories) and depth=2 (subcategories)
  const depth1Categories = allCategories.filter((c) => c.depth === 1)
  const depth2Categories = allCategories.filter((c) => c.depth === 2)

  // Build topic map by categoryId
  const topicsByCategory = new Map<string, TopicNodeResponse[]>()
  for (const topic of allTopics) {
    const list = topicsByCategory.get(topic.categoryId) ?? []
    list.push({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      difficulty: topic.difficulty as TopicNodeResponse["difficulty"],
      topicType: topic.topicType,
      aiSystemPrompt: topic.aiSystemPrompt,
      displayOrder: topic.displayOrder,
    })
    topicsByCategory.set(topic.categoryId, list)
  }

  // Build subcategory map by parentId
  const subcategoriesByParent = new Map<string, SubcategoryNodeResponse[]>()
  for (const subcat of depth2Categories) {
    if (!subcat.parentId) continue
    const list = subcategoriesByParent.get(subcat.parentId) ?? []
    list.push({
      id: subcat.id,
      name: subcat.name,
      displayOrder: subcat.displayOrder,
      topics: topicsByCategory.get(subcat.id) ?? [],
    })
    subcategoriesByParent.set(subcat.parentId, list)
  }

  // Build final category list
  const categoryNodes: CategoryNodeResponse[] = depth1Categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    displayOrder: cat.displayOrder,
    subcategories: subcategoriesByParent.get(cat.id) ?? [],
  }))

  return ok({ categories: categoryNodes })
}

/**
 * Update the tree structure for a subject using diff-based update
 */
export const updateSubjectTree = async (
  deps: TreeUseCaseDeps,
  userId: string,
  subjectId: string,
  tree: UpdateTreeRequest
): Promise<Result<void, TreeOperationError>> => {
  const now = new Date()

  // 1. Verify subject ownership
  const subject = await deps.subjectRepo.findSubjectByIdAndUserId(subjectId, userId)
  if (!subject) {
    return err("NOT_FOUND")
  }

  // 2. Collect all IDs from request
  const requestCategoryIds = new Set<string>()
  const requestTopicIds = new Set<string>()

  for (const cat of tree.categories) {
    if (cat.id) requestCategoryIds.add(cat.id)
    for (const subcat of cat.subcategories) {
      if (subcat.id) requestCategoryIds.add(subcat.id)
      for (const topic of subcat.topics) {
        if (topic.id) requestTopicIds.add(topic.id)
      }
    }
  }

  // 3. Validate category IDs (must belong to user and subject)
  let validCategoryIdSet = new Set<string>()
  if (requestCategoryIds.size > 0) {
    const validCategoryIds = await deps.subjectRepo.findCategoryIdsBySubjectIdWithSoftDeleted(
      subjectId,
      userId,
      Array.from(requestCategoryIds)
    )
    validCategoryIdSet = new Set(validCategoryIds)
    for (const id of requestCategoryIds) {
      if (!validCategoryIdSet.has(id)) {
        return err("INVALID_ID")
      }
    }
  }

  // 4. Validate topic IDs (must belong to user and be in categories of this subject)
  let validTopicIdSet = new Set<string>()
  if (requestTopicIds.size > 0) {
    const validTopicIds = await deps.subjectRepo.findTopicIdsBySubjectWithSoftDeleted(
      subjectId,
      userId,
      Array.from(requestTopicIds)
    )
    validTopicIdSet = new Set(validTopicIds)
    for (const id of requestTopicIds) {
      if (!validTopicIdSet.has(id)) {
        return err("INVALID_ID")
      }
    }
  }

  // 5. Get existing categories and topics
  const existingCategoryIds = await deps.subjectRepo.findExistingCategoryIds(subjectId, userId)
  const existingTopicIds = await deps.subjectRepo.findExistingTopicIds(subjectId, userId)

  // 6-8. Execute all mutations in a transaction for atomicity
  const runInTransaction = deps.txRunner
    ? deps.txRunner.run.bind(deps.txRunner)
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fn: (tx: Db) => Promise<void>) => (deps.db as any).transaction(fn)

  await runInTransaction(async (tx: Db) => {
    // Create a transactional repository
    const { createSubjectRepository } = await import("./repository")
    const txRepo = createSubjectRepository(tx)

    // 6. Soft-delete categories not in request
    const categoriesToDelete = existingCategoryIds.filter((id) => !requestCategoryIds.has(id))
    await txRepo.softDeleteCategories(categoriesToDelete, now)

    // 7. Soft-delete topics not in request
    const topicsToDelete = existingTopicIds.filter((id) => !requestTopicIds.has(id))
    await txRepo.softDeleteTopics(topicsToDelete, now)

    // 8. Upsert categories and topics
    for (const cat of tree.categories) {
      const categoryId = cat.id ?? crypto.randomUUID()
      const categoryExists = cat.id ? validCategoryIdSet.has(cat.id) : false

      await txRepo.upsertCategory({
        id: categoryId,
        userId,
        subjectId,
        name: cat.name,
        depth: 1,
        parentId: null,
        displayOrder: cat.displayOrder,
        now,
        isNew: !categoryExists,
      })

      for (const subcat of cat.subcategories) {
        const subcategoryId = subcat.id ?? crypto.randomUUID()
        const subcategoryExists = subcat.id ? validCategoryIdSet.has(subcat.id) : false

        await txRepo.upsertCategory({
          id: subcategoryId,
          userId,
          subjectId,
          name: subcat.name,
          depth: 2,
          parentId: categoryId,
          displayOrder: subcat.displayOrder,
          now,
          isNew: !subcategoryExists,
        })

        for (const topic of subcat.topics) {
          const topicId = topic.id ?? crypto.randomUUID()
          const topicExists = topic.id ? validTopicIdSet.has(topic.id) : false

          await txRepo.upsertTopic({
            id: topicId,
            userId,
            categoryId: subcategoryId,
            name: topic.name,
            description: topic.description ?? null,
            difficulty: topic.difficulty ?? null,
            topicType: topic.topicType ?? null,
            aiSystemPrompt: topic.aiSystemPrompt ?? null,
            displayOrder: topic.displayOrder,
            now,
            isNew: !topicExists,
          })
        }
      }
    }
  })

  return ok(undefined)
}

/**
 * Import CSV data into subject's tree (append mode)
 */
export const importCSVToSubject = async (
  deps: TreeUseCaseDeps,
  userId: string,
  subjectId: string,
  csvContent: string
): Promise<Result<CSVImportResponse, CSVImportError>> => {
  // 1. Get existing tree (also validates ownership)
  const existingTreeResult = await getSubjectTree(deps, userId, subjectId)
  if (!existingTreeResult.ok) {
    return err("NOT_FOUND")
  }

  // 2. Parse CSV
  const { rows, errors } = parseCSV(csvContent)

  if (rows.length === 0) {
    return ok({
      success: false,
      imported: { categories: 0, subcategories: 0, topics: 0 },
      errors: errors.length > 0 ? errors : [{ line: 0, message: "インポートするデータがありません" }],
    })
  }

  // 3. Convert to tree structure
  const importedTree = convertToTree(rows)

  // 4. Convert existing tree to updatable format (with IDs as string | null)
  const existingTreeForMerge = {
    categories: existingTreeResult.value.categories.map((cat) => ({
      id: cat.id as string | null,
      name: cat.name,
      displayOrder: cat.displayOrder,
      subcategories: cat.subcategories.map((subcat) => ({
        id: subcat.id as string | null,
        name: subcat.name,
        displayOrder: subcat.displayOrder,
        topics: subcat.topics.map((topic) => ({
          id: topic.id as string | null,
          name: topic.name,
          displayOrder: topic.displayOrder,
        })),
      })),
    })),
  }

  // 5. Merge with existing data
  const mergedTree = mergeTree(existingTreeForMerge, importedTree)

  // 6. Update tree
  const updateResult = await updateSubjectTree(deps, userId, subjectId, mergedTree)
  if (!updateResult.ok) {
    // This shouldn't happen since we already validated ownership
    return err("NOT_FOUND")
  }

  // 7. Count imported items
  let categoryCount = 0
  let subcategoryCount = 0
  let topicCount = 0

  for (const cat of importedTree.categories) {
    categoryCount++
    for (const subcat of cat.subcategories) {
      subcategoryCount++
      topicCount += subcat.topics.length
    }
  }

  return ok({
    success: true,
    imported: {
      categories: categoryCount,
      subcategories: subcategoryCount,
      topics: topicCount,
    },
    errors,
  })
}

// Bulk import types
export type BulkCSVImportError = "NOT_FOUND" | "FORBIDDEN"

export type BulkCSVImportResponse = {
  success: boolean
  imported: {
    subjects: number
    categories: number
    subcategories: number
    topics: number
  }
  errors: Array<{ line: number; message: string }>
}

/**
 * Bulk import 4-column CSV data into study domain
 * Creates subjects if they don't exist, then imports tree structure
 */
export const bulkImportCSVToStudyDomain = async (
  deps: TreeUseCaseDeps,
  userId: string,
  studyDomainId: string,
  csvContent: string
): Promise<Result<BulkCSVImportResponse, BulkCSVImportError>> => {
  // 1. Verify study domain ownership
  const ownsStudyDomain = await deps.subjectRepo.verifyStudyDomainOwnership(studyDomainId, userId)
  if (!ownsStudyDomain) {
    return err("NOT_FOUND")
  }

  // 2. Parse 4-column CSV
  const { rows, errors } = parseCSV4Column(csvContent)

  if (rows.length === 0) {
    return ok({
      success: false,
      imported: { subjects: 0, categories: 0, subcategories: 0, topics: 0 },
      errors: errors.length > 0 ? errors : [{ line: 0, message: "インポートするデータがありません" }],
    })
  }

  // 3. Group rows by subject name
  const groupedRows = groupRowsBySubject(rows)

  // 4. Get existing subjects for this study domain
  const existingSubjects = await deps.subjectRepo.findByStudyDomainId(studyDomainId, userId)
  const subjectNameToId = new Map<string, string>(
    existingSubjects.map((s) => [s.name, s.id])
  )

  // 5. Process each subject group
  let totalSubjects = 0
  let totalCategories = 0
  let totalSubcategories = 0
  let totalTopics = 0

  for (const [subjectName, subjectRows] of groupedRows) {
    let subjectId = subjectNameToId.get(subjectName)

    // Create subject if it doesn't exist
    if (!subjectId) {
      const maxOrder = existingSubjects.reduce((max, s) => Math.max(max, s.displayOrder), -1)
      const createResult = await deps.subjectRepo.create({
        userId,
        studyDomainId,
        name: subjectName,
        displayOrder: maxOrder + 1 + totalSubjects,
      })
      subjectId = createResult.id
      totalSubjects++
    }

    // Get existing tree for this subject
    const existingTreeResult = await getSubjectTree(deps, userId, subjectId)
    if (!existingTreeResult.ok) {
      continue // Skip if we can't get the tree (shouldn't happen)
    }

    // Convert subject rows to tree structure
    const importedTree = convertToTree(subjectRows)

    // Convert existing tree to updatable format
    const existingTreeForMerge = {
      categories: existingTreeResult.value.categories.map((cat) => ({
        id: cat.id as string | null,
        name: cat.name,
        displayOrder: cat.displayOrder,
        subcategories: cat.subcategories.map((subcat) => ({
          id: subcat.id as string | null,
          name: subcat.name,
          displayOrder: subcat.displayOrder,
          topics: subcat.topics.map((topic) => ({
            id: topic.id as string | null,
            name: topic.name,
            displayOrder: topic.displayOrder,
          })),
        })),
      })),
    }

    // Merge with existing data
    const mergedTree = mergeTree(existingTreeForMerge, importedTree)

    // Update tree
    await updateSubjectTree(deps, userId, subjectId, mergedTree)

    // Count imported items for this subject
    for (const cat of importedTree.categories) {
      totalCategories++
      for (const subcat of cat.subcategories) {
        totalSubcategories++
        totalTopics += subcat.topics.length
      }
    }
  }

  return ok({
    success: true,
    imported: {
      subjects: totalSubjects,
      categories: totalCategories,
      subcategories: totalSubcategories,
      topics: totalTopics,
    },
    errors,
  })
}

// ============================================
// 進捗・フィルタ・検索関連のusecase関数
// ============================================

/**
 * 科目一覧取得（統計情報付き）
 */
export const listSubjectsWithStats = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  studyDomainId?: string
): Promise<SubjectWithStats[]> => {
  const subjects = await deps.subjectRepo.findAllSubjectsForUser(studyDomainId, userId)

  // バッチ取得でN+1クエリを削減
  const subjectIds = subjects.map((s) => s.id)
  const batchStats = await deps.subjectRepo.getBatchSubjectStats(subjectIds, userId)
  const statsMap = new Map(batchStats.map((s) => [s.subjectId, s]))

  return subjects.map((subject) => {
    const stats = statsMap.get(subject.id) ?? { categoryCount: 0, topicCount: 0 }
    return {
      id: subject.id,
      studyDomainId: subject.studyDomainId,
      name: subject.name,
      description: subject.description,
      emoji: subject.emoji,
      color: subject.color,
      displayOrder: subject.displayOrder,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
      categoryCount: stats.categoryCount,
      topicCount: stats.topicCount,
    }
  })
}

/**
 * 科目詳細取得（統計情報付き）
 */
export const getSubjectWithStats = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  subjectId: string
): Promise<SubjectWithStats | null> => {
  const subject = await deps.subjectRepo.findSubjectByIdForUser(subjectId, userId)

  if (!subject) {
    return null
  }

  const stats = await deps.subjectRepo.getSubjectStats(subjectId, userId)

  return {
    id: subject.id,
    studyDomainId: subject.studyDomainId,
    name: subject.name,
    description: subject.description,
    emoji: subject.emoji,
    color: subject.color,
    displayOrder: subject.displayOrder,
    createdAt: subject.createdAt.toISOString(),
    updatedAt: subject.updatedAt.toISOString(),
    categoryCount: stats.categoryCount,
    topicCount: stats.topicCount,
  }
}

/**
 * カテゴリ一覧（階層構造）取得
 */
export const listCategoriesHierarchy = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  subjectId: string
): Promise<CategoryNode[]> => {
  const [categories, topicCounts, progressCounts] = await Promise.all([
    deps.subjectRepo.findCategoriesHierarchy(subjectId, userId),
    deps.subjectRepo.getCategoryTopicCounts(subjectId, userId),
    deps.subjectRepo.getProgressCountsByCategory(userId, subjectId),
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
      id: cat.id,
      subjectId: cat.subjectId,
      parentId: cat.parentId,
      name: cat.name,
      depth: cat.depth,
      displayOrder: cat.displayOrder,
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

/**
 * カテゴリの論点一覧取得
 */
export const listTopicsByCategory = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  categoryId: string
): Promise<TopicResponse[]> => {
  const topics = await deps.subjectRepo.findTopicsByCategoryIdForUser(categoryId, userId)

  return topics.map((t) => ({
    id: t.id,
    categoryId: t.categoryId,
    name: t.name,
    description: t.description,
    displayOrder: t.displayOrder,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))
}

/**
 * 論点詳細取得（進捗含む）
 */
export const getTopicWithProgress = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  topicId: string
): Promise<TopicWithProgressResponse | null> => {
  const topic = await deps.subjectRepo.findTopicWithHierarchy(topicId, userId)
  if (!topic) return null

  const progress = await deps.subjectRepo.findProgress(userId, topicId)

  // アクセス記録を更新
  await deps.subjectRepo.upsertProgress({ userId, topicId })

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
          userId: progress.userId,
          topicId: progress.topicId,
          understood: progress.understood,
          lastAccessedAt: progress.lastAccessedAt?.toISOString() ?? null,
          createdAt: progress.createdAt.toISOString(),
          updatedAt: progress.updatedAt.toISOString(),
        }
      : null,
  }
}

/**
 * 進捗更新
 */
export const updateProgress = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  topicId: string,
  understood?: boolean
): Promise<ProgressResponse> => {
  // 現在の進捗を取得して、understood が変更されたかチェック
  const currentProgress = await deps.subjectRepo.findProgress(userId, topicId)
  const previousUnderstood = currentProgress?.understood ?? false

  const progress = await deps.subjectRepo.upsertProgress({
    userId,
    topicId,
    understood,
  })

  // understood フラグが変更された場合は履歴を記録
  if (understood !== undefined && understood !== previousUnderstood) {
    await deps.subjectRepo.createCheckHistory({
      userId,
      topicId,
      action: understood ? "checked" : "unchecked",
    })
  }

  return {
    userId: progress.userId,
    topicId: progress.topicId,
    understood: progress.understood,
    lastAccessedAt: progress.lastAccessedAt?.toISOString() ?? null,
    createdAt: progress.createdAt.toISOString(),
    updatedAt: progress.updatedAt.toISOString(),
  }
}

/**
 * ユーザーの全進捗取得
 */
export const listUserProgress = async (
  deps: SubjectUseCaseDeps,
  userId: string
): Promise<ProgressResponse[]> => {
  const progressList = await deps.subjectRepo.findProgressByUser(userId)

  return progressList.map((p) => ({
    userId: p.userId,
    topicId: p.topicId,
    understood: p.understood,
    lastAccessedAt: p.lastAccessedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))
}

/**
 * チェック履歴取得
 */
export const getCheckHistory = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  topicId: string
): Promise<CheckHistoryResponse[]> => {
  const history = await deps.subjectRepo.findCheckHistoryByTopic(userId, topicId)

  return history.map((h) => ({
    id: h.id,
    action: h.action,
    checkedAt: h.checkedAt.toISOString(),
  }))
}

/**
 * 科目別進捗統計取得
 */
export const getSubjectProgressStats = async (
  deps: SubjectUseCaseDeps,
  userId: string
): Promise<SubjectProgressStats[]> => {
  const [subjects, progressCounts] = await Promise.all([
    deps.subjectRepo.findAllSubjectsForUser(undefined, userId),
    deps.subjectRepo.getProgressCountsBySubject(userId),
  ])

  // 科目ごとのトピック数をバッチ取得（N+1クエリ削減）
  const subjectIds = subjects.map((s) => s.id)
  const batchStats = await deps.subjectRepo.getBatchSubjectStats(subjectIds, userId)

  const topicCountMap = new Map(
    batchStats.map((s) => [s.subjectId, s.topicCount])
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

/**
 * 最近触った論点取得
 */
export const listRecentTopics = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  limit: number = 10
): Promise<RecentTopicResponse[]> => {
  const topics = await deps.subjectRepo.findRecentTopics(userId, limit)

  return topics.map((t) => ({
    topicId: t.topicId,
    topicName: t.topicName,
    subjectId: t.subjectId,
    subjectName: t.subjectName,
    categoryId: t.categoryId,
    lastAccessedAt: t.lastAccessedAt.toISOString(),
  }))
}

/**
 * フィルタ済み論点取得
 */
export const filterTopics = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  filters: TopicFilterParams
): Promise<FilteredTopicResponse[]> => {
  const topics = await deps.subjectRepo.findFilteredTopics(userId, filters)

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

/**
 * 論点検索（ドメイン内）
 */
export const searchTopicsInDomain = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  studyDomainId: string,
  query: string,
  limit: number = 20
): Promise<SearchTopicRow[]> => {
  return deps.subjectRepo.searchTopics(studyDomainId, userId, query, limit)
}
