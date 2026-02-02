import type { Db } from "@cpa-study/db"
import type {
  UpdateTreeRequest,
  TreeResponse,
  CategoryNodeResponse,
  TopicNodeResponse,
  CSVImportResponse,
} from "@cpa-study/shared/schemas"
import type { SubjectRepository, Subject, CreateSubjectInput, UpdateSubjectInput } from "./repository"
import { parseCSV, convertToTree, mergeTree } from "./csv-parser"
import type { SimpleTransactionRunner } from "../../shared/lib/transaction"

// Result type for operations
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

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
 * Now simplified: categories directly contain topics (no subcategories)
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

  // 2. Get all categories for this subject (only depth=1 now)
  const allCategories = await deps.subjectRepo.findCategoriesBySubjectId(subjectId, userId)

  // 3. Get all topics for categories in this subject
  const categoryIds = allCategories.map((c) => c.id)
  const allTopics = await deps.subjectRepo.findTopicsByCategoryIds(categoryIds, userId)

  // 4. Build tree structure (simplified: categories directly contain topics)
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

  // Build final category list (all categories now directly contain topics)
  const categoryNodes: CategoryNodeResponse[] = allCategories
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      displayOrder: cat.displayOrder,
      topics: (topicsByCategory.get(cat.id) ?? []).sort((a, b) => a.displayOrder - b.displayOrder),
    }))

  return ok({ categories: categoryNodes })
}

/**
 * Update the tree structure for a subject using diff-based update
 * Simplified: categories directly contain topics
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
    for (const topic of cat.topics) {
      if (topic.id) requestTopicIds.add(topic.id)
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

    // 8. Upsert categories and topics (simplified: no subcategories)
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

      for (const topic of cat.topics) {
        const topicId = topic.id ?? crypto.randomUUID()
        const topicExists = topic.id ? validTopicIdSet.has(topic.id) : false

        await txRepo.upsertTopic({
          id: topicId,
          userId,
          categoryId,
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
  })

  return ok(undefined)
}

/**
 * Import CSV data into subject's tree (append mode)
 * CSV format: 科目,カテゴリ,論点
 * Only rows matching the target subject name are imported
 */
export const importCSVToSubject = async (
  deps: TreeUseCaseDeps,
  userId: string,
  subjectId: string,
  csvContent: string
): Promise<Result<CSVImportResponse, CSVImportError>> => {
  // 1. Get subject info and existing tree
  const subject = await deps.subjectRepo.findById(subjectId, userId)
  if (!subject) {
    return err("NOT_FOUND")
  }

  const existingTreeResult = await getSubjectTree(deps, userId, subjectId)
  if (!existingTreeResult.ok) {
    return err("NOT_FOUND")
  }

  // 2. Parse CSV
  const { rows, errors } = parseCSV(csvContent)

  // 3. Filter rows by subject name (case-insensitive match)
  const filteredRows = rows.filter(
    (row) => row.subject.toLowerCase() === subject.name.toLowerCase()
  )

  if (filteredRows.length === 0) {
    const message = rows.length > 0
      ? `科目「${subject.name}」に一致するデータがありません`
      : "インポートするデータがありません"
    return ok({
      success: false,
      imported: { categories: 0, topics: 0 },
      errors: errors.length > 0 ? errors : [{ line: 0, message }],
    })
  }

  // 4. Convert to tree structure
  const importedTree = convertToTree(filteredRows)

  // 4. Convert existing tree to updatable format (with IDs as string | null)
  const existingTreeForMerge = {
    categories: existingTreeResult.value.categories.map((cat) => ({
      id: cat.id as string | null,
      name: cat.name,
      displayOrder: cat.displayOrder,
      topics: cat.topics.map((topic) => ({
        id: topic.id as string | null,
        name: topic.name,
        displayOrder: topic.displayOrder,
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
  let topicCount = 0

  for (const cat of importedTree.categories) {
    categoryCount++
    topicCount += cat.topics.length
  }

  return ok({
    success: true,
    imported: {
      categories: categoryCount,
      topics: topicCount,
    },
    errors,
  })
}

export type BulkCSVImportResponse = {
  success: boolean
  imported: {
    subjects: number
    categories: number
    topics: number
  }
  errors: Array<{ line: number; message: string }>
}

/**
 * Bulk import CSV data into a study domain
 * Creates subjects if they don't exist, then imports categories/topics
 * CSV format: 科目,カテゴリ,論点
 */
export const bulkImportCSVToStudyDomain = async (
  deps: TreeUseCaseDeps,
  userId: string,
  studyDomainId: string,
  csvContent: string
): Promise<Result<BulkCSVImportResponse, CSVImportError>> => {
  // 1. Verify study domain ownership
  const ownsStudyDomain = await deps.subjectRepo.verifyStudyDomainOwnership(studyDomainId, userId)
  if (!ownsStudyDomain) {
    return err("NOT_FOUND")
  }

  // 2. Parse CSV
  const { rows, errors } = parseCSV(csvContent)

  if (rows.length === 0) {
    return ok({
      success: false,
      imported: { subjects: 0, categories: 0, topics: 0 },
      errors: errors.length > 0 ? errors : [{ line: 0, message: "インポートするデータがありません" }],
    })
  }

  // 3. Group rows by subject name
  const subjectMap = new Map<string, typeof rows>()
  for (const row of rows) {
    const subjectName = row.subject
    if (!subjectMap.has(subjectName)) {
      subjectMap.set(subjectName, [])
    }
    subjectMap.get(subjectName)!.push(row)
  }

  // 4. Get existing subjects in this domain
  const existingSubjects = await deps.subjectRepo.findByStudyDomainId(studyDomainId, userId)
  const subjectByName = new Map(existingSubjects.map((s) => [s.name.toLowerCase(), s]))

  // 5. Process each subject group
  let totalSubjects = 0
  let totalCategories = 0
  let totalTopics = 0

  for (const [subjectName, subjectRows] of subjectMap) {
    let subject: Subject | null | undefined = subjectByName.get(subjectName.toLowerCase())

    // Create subject if it doesn't exist
    if (!subject) {
      const createResult = await deps.subjectRepo.create({
        userId,
        studyDomainId,
        name: subjectName,
        description: null,
        emoji: null,
        color: null,
        displayOrder: existingSubjects.length + totalSubjects,
      })
      subject = await deps.subjectRepo.findById(createResult.id, userId)
      if (!subject) {
        continue // Should not happen
      }
      totalSubjects++
    }

    // Get existing tree for this subject
    const existingTreeResult = await getSubjectTree(deps, userId, subject.id)
    if (!existingTreeResult.ok) {
      continue
    }

    // Convert rows to tree (subject field is ignored in convertToTree)
    const importedTree = convertToTree(subjectRows)

    // Merge with existing
    const existingTreeForMerge = {
      categories: existingTreeResult.value.categories.map((cat) => ({
        id: cat.id as string | null,
        name: cat.name,
        displayOrder: cat.displayOrder,
        topics: cat.topics.map((topic) => ({
          id: topic.id as string | null,
          name: topic.name,
          displayOrder: topic.displayOrder,
        })),
      })),
    }
    const mergedTree = mergeTree(existingTreeForMerge, importedTree)

    // Update tree
    await updateSubjectTree(deps, userId, subject.id, mergedTree)

    // Count imported items
    for (const cat of importedTree.categories) {
      totalCategories++
      totalTopics += cat.topics.length
    }
  }

  return ok({
    success: true,
    imported: {
      subjects: totalSubjects,
      categories: totalCategories,
      topics: totalTopics,
    },
    errors,
  })
}
