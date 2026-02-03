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
} from "./repository"
import { parseCSV, parseCSV4Column, groupRowsBySubject, convertToTree, mergeTree } from "./csv-parser"
import type { SimpleTransactionRunner } from "../../shared/lib/transaction"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, badRequest, conflict, type AppError } from "@/shared/lib/errors"

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
export type SubjectUseCaseDeps = {
  subjectRepo: SubjectRepository
}

// UseCase functions
export const listSubjects = async (
  deps: SubjectUseCaseDeps,
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
  deps: SubjectUseCaseDeps,
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
  deps: SubjectUseCaseDeps,
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
  deps: SubjectUseCaseDeps,
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
  deps: SubjectUseCaseDeps,
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
): Promise<Result<TreeResponse, AppError>> => {
  // 1. Verify subject ownership
  const subject = await deps.subjectRepo.findSubjectByIdAndUserId(subjectId, userId)
  if (!subject) {
    return err(notFound("科目が見つかりません"))
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
): Promise<Result<void, AppError>> => {
  const now = new Date()

  // 1. Verify subject ownership
  const subject = await deps.subjectRepo.findSubjectByIdAndUserId(subjectId, userId)
  if (!subject) {
    return err(notFound("科目が見つかりません"))
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
        return err(badRequest("不正なカテゴリIDが含まれています", { invalidId: id }))
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
        return err(badRequest("不正な論点IDが含まれています", { invalidId: id }))
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
    // Note: dynamic import を使用する理由:
    // 1. トランザクションコールバック内で新しいリポジトリインスタンスを作成する必要がある
    // 2. 静的importだと、このファイルがrepositoryをimport→repositoryがtypesをimportの
    //    循環依存が発生する可能性がある
    // 3. Workers環境ではモジュールはバンドル時に解決されるため、実行時の動的importは
    //    コールドスタートに影響しない（ただし可読性は下がる）
    // TODO: 将来的にはDI経由でトランザクション対応リポジトリを受け取る設計に改善可能
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
): Promise<Result<CSVImportResponse, AppError>> => {
  // 1. Get existing tree (also validates ownership)
  const existingTreeResult = await getSubjectTree(deps, userId, subjectId)
  if (!existingTreeResult.ok) {
    return err(notFound("科目が見つかりません"))
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
    return updateResult
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
): Promise<Result<BulkCSVImportResponse, AppError>> => {
  // 1. Verify study domain ownership
  const ownsStudyDomain = await deps.subjectRepo.verifyStudyDomainOwnership(studyDomainId, userId)
  if (!ownsStudyDomain) {
    return err(notFound("学習領域が見つかりません"))
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
