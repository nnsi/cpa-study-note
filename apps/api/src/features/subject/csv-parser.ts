import type { UpdateTreeRequest } from "@cpa-study/shared/schemas"

export type ParsedRow = {
  subject: string
  category: string
  topic: string
}

export type ParseError = {
  line: number
  message: string
}

export type ParseResult = {
  rows: ParsedRow[]
  errors: ParseError[]
}

/**
 * Split CSV content into lines, respecting quoted fields with embedded newlines
 */
const splitCSVLines = (content: string): string[] => {
  const lines: string[] = []
  let current = ""
  let inQuote = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]

    if (char === '"') {
      inQuote = !inQuote
      current += char
    } else if ((char === "\n" || char === "\r") && !inQuote) {
      if (char === "\r" && content[i + 1] === "\n") {
        i++ // Skip CRLF
      }
      lines.push(current)
      current = ""
    } else {
      current += char
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

/**
 * Parse a single CSV line into fields (RFC 4180 compliant)
 */
const parseCSVLine = (line: string): string[] => {
  const fields: string[] = []
  let current = ""
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuote) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          // Escaped double quote
          current += '"'
          i++
        } else {
          // End quote
          inQuote = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuote = true
      } else if (char === ",") {
        fields.push(current)
        current = ""
      } else {
        current += char
      }
    }
  }

  fields.push(current)
  return fields
}

/**
 * Parse CSV content into structured rows (RFC 4180 compliant)
 * Expected format: 科目,カテゴリ,論点
 */
export const parseCSV = (csvContent: string): ParseResult => {
  const rows: ParsedRow[] = []
  const errors: ParseError[] = []

  const lines = splitCSVLines(csvContent)

  // Skip header row (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip empty lines

    const fields = parseCSVLine(line)

    if (fields.length < 3) {
      errors.push({ line: i + 1, message: "3列必要です（科目, カテゴリ, 論点）" })
      continue
    }

    const [subject, category, topic] = fields.map((f) => f.trim())

    if (!subject || !category || !topic) {
      errors.push({ line: i + 1, message: "空のフィールドがあります" })
      continue
    }

    rows.push({ subject, category, topic })
  }

  return { rows, errors }
}

/**
 * Convert parsed rows to tree structure for updateSubjectTree
 */
export const convertToTree = (rows: ParsedRow[]): UpdateTreeRequest => {
  const categoryMap = new Map<
    string,
    {
      name: string
      topics: string[]
    }
  >()

  for (const row of rows) {
    if (!categoryMap.has(row.category)) {
      categoryMap.set(row.category, {
        name: row.category,
        topics: [],
      })
    }

    const category = categoryMap.get(row.category)!

    // Avoid duplicates
    if (!category.topics.includes(row.topic)) {
      category.topics.push(row.topic)
    }
  }

  // Convert to tree format
  let categoryOrder = 0
  const categories = Array.from(categoryMap.values()).map((cat) => {
    let topicOrder = 0
    return {
      id: null,
      name: cat.name,
      displayOrder: categoryOrder++,
      topics: cat.topics.map((topicName) => ({
        id: null,
        name: topicName,
        displayOrder: topicOrder++,
      })),
    }
  })

  return { categories }
}

/**
 * Merge imported tree into existing tree (append mode)
 * - Same category names are merged (topics combined)
 * - Preserves existing IDs
 */
export const mergeTree = (
  existing: UpdateTreeRequest,
  imported: UpdateTreeRequest
): UpdateTreeRequest => {
  // Build a map of existing categories
  const categoryMap = new Map<
    string,
    {
      id: string | null
      name: string
      displayOrder: number
      topics: Map<string, { id: string | null; name: string; displayOrder: number }>
    }
  >()

  // Load existing into map
  for (const cat of existing.categories) {
    const topicMap = new Map<string, { id: string | null; name: string; displayOrder: number }>()
    for (const topic of cat.topics) {
      topicMap.set(topic.name, {
        id: topic.id,
        name: topic.name,
        displayOrder: topic.displayOrder,
      })
    }

    categoryMap.set(cat.name, {
      id: cat.id,
      name: cat.name,
      displayOrder: cat.displayOrder,
      topics: topicMap,
    })
  }

  // Merge imported into map
  let maxCategoryOrder = Math.max(0, ...existing.categories.map((c) => c.displayOrder)) + 1

  for (const importedCat of imported.categories) {
    if (!categoryMap.has(importedCat.name)) {
      // New category
      categoryMap.set(importedCat.name, {
        id: null,
        name: importedCat.name,
        displayOrder: maxCategoryOrder++,
        topics: new Map(),
      })
    }

    const category = categoryMap.get(importedCat.name)!
    let maxTopicOrder =
      Math.max(0, ...Array.from(category.topics.values()).map((t) => t.displayOrder)) + 1

    for (const importedTopic of importedCat.topics) {
      if (!category.topics.has(importedTopic.name)) {
        // New topic
        category.topics.set(importedTopic.name, {
          id: null,
          name: importedTopic.name,
          displayOrder: maxTopicOrder++,
        })
      }
      // Existing topics are kept as-is (no update)
    }
  }

  // Convert map back to tree
  const categories = Array.from(categoryMap.values())
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      displayOrder: cat.displayOrder,
      topics: Array.from(cat.topics.values())
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((topic) => ({
          id: topic.id,
          name: topic.name,
          displayOrder: topic.displayOrder,
        })),
    }))

  return { categories }
}
