import { eq, and, isNull, inArray } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { subjects, categories, topics } from "@cpa-study/db/schema"
import type {
  UpdateTreeRequest,
  TreeResponse,
  CategoryNodeResponse,
  SubcategoryNodeResponse,
  TopicNodeResponse,
} from "@cpa-study/shared/schemas"
import type { SimpleTransactionRunner } from "../../shared/lib/transaction"

// Result type for operations
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

// Error types
export type TreeOperationError = "NOT_FOUND" | "FORBIDDEN" | "INVALID_ID"

/**
 * Get the tree structure for a subject
 */
export const getSubjectTree = async (
  db: Db,
  userId: string,
  subjectId: string
): Promise<Result<TreeResponse, TreeOperationError>> => {
  // 1. Verify subject ownership
  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(
      and(eq(subjects.id, subjectId), eq(subjects.userId, userId), isNull(subjects.deletedAt))
    )
    .limit(1)

  if (!subject) {
    return err("NOT_FOUND")
  }

  // 2. Get all categories for this subject
  const allCategories = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.subjectId, subjectId), eq(categories.userId, userId), isNull(categories.deletedAt))
    )
    .orderBy(categories.displayOrder)

  // 3. Get all topics for categories in this subject
  const categoryIds = allCategories.map((c) => c.id)
  const allTopics =
    categoryIds.length > 0
      ? await db
          .select()
          .from(topics)
          .where(and(inArray(topics.categoryId, categoryIds), eq(topics.userId, userId), isNull(topics.deletedAt)))
          .orderBy(topics.displayOrder)
      : []

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
 *
 * @param db - Database instance
 * @param userId - User ID for ownership verification
 * @param subjectId - Subject ID to update
 * @param tree - Tree structure to apply
 * @param txRunner - Optional transaction runner (for testing with better-sqlite3)
 *                   If not provided, uses db.transaction() (works with D1)
 */
export const updateSubjectTree = async (
  db: Db,
  userId: string,
  subjectId: string,
  tree: UpdateTreeRequest,
  txRunner?: SimpleTransactionRunner
): Promise<Result<void, TreeOperationError>> => {
  const now = new Date()

  // 1. Verify subject ownership
  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(
      and(eq(subjects.id, subjectId), eq(subjects.userId, userId), isNull(subjects.deletedAt))
    )
    .limit(1)

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
  // Note: This includes soft-deleted categories for revival support
  let validCategoryIdSet = new Set<string>()
  if (requestCategoryIds.size > 0) {
    const validCategories = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          inArray(categories.id, Array.from(requestCategoryIds)),
          eq(categories.userId, userId),
          eq(categories.subjectId, subjectId)
        )
      )

    validCategoryIdSet = new Set(validCategories.map((c) => c.id))
    for (const id of requestCategoryIds) {
      if (!validCategoryIdSet.has(id)) {
        return err("INVALID_ID")
      }
    }
  }

  // 4. Validate topic IDs (must belong to user and be in categories of this subject)
  // Note: This includes soft-deleted topics for revival support
  let validTopicIdSet = new Set<string>()
  if (requestTopicIds.size > 0) {
    const validTopics = await db
      .select({ id: topics.id })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .where(
        and(
          inArray(topics.id, Array.from(requestTopicIds)),
          eq(topics.userId, userId),
          eq(categories.subjectId, subjectId)
        )
      )

    validTopicIdSet = new Set(validTopics.map((t) => t.id))
    for (const id of requestTopicIds) {
      if (!validTopicIdSet.has(id)) {
        return err("INVALID_ID")
      }
    }
  }

  // 5. Get existing categories and topics
  const existingCategories = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(eq(categories.subjectId, subjectId), eq(categories.userId, userId), isNull(categories.deletedAt))
    )

  const existingTopics = await db
    .select({ id: topics.id })
    .from(topics)
    .innerJoin(categories, eq(topics.categoryId, categories.id))
    .where(
      and(eq(categories.subjectId, subjectId), eq(topics.userId, userId), isNull(topics.deletedAt))
    )

  // 6-8. Execute all mutations in a transaction for atomicity
  // D1 uses batch() internally, better-sqlite3 requires sync transactions
  const runInTransaction = txRunner
    ? txRunner.run.bind(txRunner)
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fn: (tx: Db) => Promise<void>) => (db as any).transaction(fn)

  await runInTransaction(async (tx: Db) => {
    // 6. Soft-delete categories not in request (bulk operation)
    const categoriesToDelete = existingCategories
      .filter((cat) => !requestCategoryIds.has(cat.id))
      .map((cat) => cat.id)
    if (categoriesToDelete.length > 0) {
      await tx
        .update(categories)
        .set({ deletedAt: now })
        .where(inArray(categories.id, categoriesToDelete))
    }

    // 7. Soft-delete topics not in request (bulk operation)
    const topicsToDelete = existingTopics
      .filter((topic) => !requestTopicIds.has(topic.id))
      .map((topic) => topic.id)
    if (topicsToDelete.length > 0) {
      await tx
        .update(topics)
        .set({ deletedAt: now })
        .where(inArray(topics.id, topicsToDelete))
    }

    // 8. Upsert categories and topics
    for (const cat of tree.categories) {
      const categoryId = cat.id ?? crypto.randomUUID()

      // Check if category exists using validation set (includes soft-deleted for revival)
      const categoryExists = cat.id ? validCategoryIdSet.has(cat.id) : false

      if (categoryExists) {
        // Update existing
        await tx
          .update(categories)
          .set({
            name: cat.name,
            depth: 1, // Ensure correct depth when moving nodes
            parentId: null, // Top-level categories have no parent
            displayOrder: cat.displayOrder,
            updatedAt: now,
            deletedAt: null, // Revive if soft-deleted
          })
          .where(eq(categories.id, categoryId))
      } else {
        // Insert new
        await tx.insert(categories).values({
          id: categoryId,
          userId,
          subjectId,
          name: cat.name,
          depth: 1,
          parentId: null,
          displayOrder: cat.displayOrder,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })
      }

      for (const subcat of cat.subcategories) {
        const subcategoryId = subcat.id ?? crypto.randomUUID()

        // Check if subcategory exists using validation set (includes soft-deleted for revival)
        const subcategoryExists = subcat.id ? validCategoryIdSet.has(subcat.id) : false

        if (subcategoryExists) {
          // Update existing
          await tx
            .update(categories)
            .set({
              name: subcat.name,
              depth: 2, // Ensure correct depth when moving nodes
              parentId: categoryId,
              displayOrder: subcat.displayOrder,
              updatedAt: now,
              deletedAt: null, // Revive if soft-deleted
            })
            .where(eq(categories.id, subcategoryId))
        } else {
          // Insert new
          await tx.insert(categories).values({
            id: subcategoryId,
            userId,
            subjectId,
            name: subcat.name,
            depth: 2,
            parentId: categoryId,
            displayOrder: subcat.displayOrder,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          })
        }

        for (const topic of subcat.topics) {
          const topicId = topic.id ?? crypto.randomUUID()

          // Check if topic exists using validation set (includes soft-deleted for revival)
          const topicExists = topic.id ? validTopicIdSet.has(topic.id) : false

          if (topicExists) {
            // Update existing
            await tx
              .update(topics)
              .set({
                categoryId: subcategoryId,
                name: topic.name,
                description: topic.description ?? null,
                difficulty: topic.difficulty ?? null,
                topicType: topic.topicType ?? null,
                aiSystemPrompt: topic.aiSystemPrompt ?? null,
                displayOrder: topic.displayOrder,
                updatedAt: now,
                deletedAt: null, // Revive if soft-deleted
              })
              .where(eq(topics.id, topicId))
          } else {
            // Insert new
            await tx.insert(topics).values({
              id: topicId,
              userId,
              categoryId: subcategoryId,
              name: topic.name,
              description: topic.description ?? null,
              difficulty: topic.difficulty ?? null,
              topicType: topic.topicType ?? null,
              aiSystemPrompt: topic.aiSystemPrompt ?? null,
              displayOrder: topic.displayOrder,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
            })
          }
        }
      }
    }
  })

  return ok(undefined)
}
