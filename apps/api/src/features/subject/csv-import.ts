import type { Db } from "@cpa-study/db"
import type { CSVImportResponse } from "@cpa-study/shared/schemas"
import { parseCSV, convertToTree, mergeTree, type ParseError } from "./csv-parser"
import { getSubjectTree, updateSubjectTree } from "./tree"

// Result type for operations
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

// Error types
export type CSVImportError = "NOT_FOUND" | "FORBIDDEN"

/**
 * Import CSV data into subject's tree (append mode)
 */
export const importCSV = async (
  db: Db,
  userId: string,
  subjectId: string,
  csvContent: string
): Promise<Result<CSVImportResponse, CSVImportError>> => {
  // 1. Get existing tree (also validates ownership)
  const existingTreeResult = await getSubjectTree(db, userId, subjectId)
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
  const updateResult = await updateSubjectTree(db, userId, subjectId, mergedTree)
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
