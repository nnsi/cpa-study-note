import type { UpdateTreeRequest } from "@cpa-study/shared/schemas"

export type ParsedRow = {
  largeCategory: string
  mediumCategory: string
  topic: string
}

// 4-column CSV row type
export type ParsedRow4Column = {
  subject: string // 科目名
  largeCategory: string // 大項目（カテゴリ）
  mediumCategory: string // 中項目（単元）
  topic: string // 小項目（論点）
}

export type ParseError = {
  line: number
  message: string
}

export type ParseResult = {
  rows: ParsedRow[]
  errors: ParseError[]
}

export type ParseResult4Column = {
  rows: ParsedRow4Column[]
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
 * Expected format: 大単元,中単元,論点
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
      errors.push({ line: i + 1, message: "3列必要です（大単元, 中単元, 論点）" })
      continue
    }

    const [large, medium, topic] = fields.map((f) => f.trim())

    if (!large || !medium || !topic) {
      errors.push({ line: i + 1, message: "空のフィールドがあります" })
      continue
    }

    rows.push({ largeCategory: large, mediumCategory: medium, topic })
  }

  return { rows, errors }
}

/**
 * Parse 4-column CSV content into structured rows (RFC 4180 compliant)
 * Expected format: 科目名,大項目,中項目,小項目
 */
export const parseCSV4Column = (csvContent: string): ParseResult4Column => {
  const rows: ParsedRow4Column[] = []
  const errors: ParseError[] = []

  const lines = splitCSVLines(csvContent)

  // Skip header row (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip empty lines

    const fields = parseCSVLine(line)

    if (fields.length < 4) {
      errors.push({ line: i + 1, message: "4列必要です（科目名, 大項目, 中項目, 小項目）" })
      continue
    }

    const [subject, large, medium, topic] = fields.map((f) => f.trim())

    if (!subject || !large || !medium || !topic) {
      errors.push({ line: i + 1, message: "空のフィールドがあります" })
      continue
    }

    rows.push({
      subject,
      largeCategory: large,
      mediumCategory: medium,
      topic,
    })
  }

  return { rows, errors }
}

/**
 * Group 4-column parsed rows by subject name
 */
export const groupRowsBySubject = (
  rows: ParsedRow4Column[]
): Map<string, ParsedRow[]> => {
  const grouped = new Map<string, ParsedRow[]>()

  for (const row of rows) {
    const existing = grouped.get(row.subject) ?? []
    existing.push({
      largeCategory: row.largeCategory,
      mediumCategory: row.mediumCategory,
      topic: row.topic,
    })
    grouped.set(row.subject, existing)
  }

  return grouped
}

/**
 * Convert parsed rows to tree structure for updateSubjectTree
 */
export const convertToTree = (rows: ParsedRow[]): UpdateTreeRequest => {
  const categoryMap = new Map<
    string,
    {
      name: string
      subcategories: Map<string, { name: string; topics: string[] }>
    }
  >()

  for (const row of rows) {
    if (!categoryMap.has(row.largeCategory)) {
      categoryMap.set(row.largeCategory, {
        name: row.largeCategory,
        subcategories: new Map(),
      })
    }

    const category = categoryMap.get(row.largeCategory)!

    if (!category.subcategories.has(row.mediumCategory)) {
      category.subcategories.set(row.mediumCategory, {
        name: row.mediumCategory,
        topics: [],
      })
    }

    const subcategory = category.subcategories.get(row.mediumCategory)!

    // Avoid duplicates
    if (!subcategory.topics.includes(row.topic)) {
      subcategory.topics.push(row.topic)
    }
  }

  // Convert to tree format
  let categoryOrder = 0
  const categories = Array.from(categoryMap.values()).map((cat) => {
    let subcategoryOrder = 0
    return {
      id: null,
      name: cat.name,
      displayOrder: categoryOrder++,
      subcategories: Array.from(cat.subcategories.values()).map((subcat) => {
        let topicOrder = 0
        return {
          id: null,
          name: subcat.name,
          displayOrder: subcategoryOrder++,
          topics: subcat.topics.map((topicName) => ({
            id: null,
            name: topicName,
            displayOrder: topicOrder++,
          })),
        }
      }),
    }
  })

  return { categories }
}

/**
 * Merge imported tree into existing tree (append mode)
 * - Same category names are merged (subcategories combined)
 * - Same subcategory names within same category are merged (topics combined)
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
      subcategories: Map<
        string,
        {
          id: string | null
          name: string
          displayOrder: number
          topics: Map<string, { id: string | null; name: string; displayOrder: number }>
        }
      >
    }
  >()

  // Load existing into map
  for (const cat of existing.categories) {
    const subcatMap = new Map<
      string,
      {
        id: string | null
        name: string
        displayOrder: number
        topics: Map<string, { id: string | null; name: string; displayOrder: number }>
      }
    >()

    for (const subcat of cat.subcategories) {
      const topicMap = new Map<string, { id: string | null; name: string; displayOrder: number }>()
      for (const topic of subcat.topics) {
        topicMap.set(topic.name, {
          id: topic.id,
          name: topic.name,
          displayOrder: topic.displayOrder,
        })
      }
      subcatMap.set(subcat.name, {
        id: subcat.id,
        name: subcat.name,
        displayOrder: subcat.displayOrder,
        topics: topicMap,
      })
    }

    categoryMap.set(cat.name, {
      id: cat.id,
      name: cat.name,
      displayOrder: cat.displayOrder,
      subcategories: subcatMap,
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
        subcategories: new Map(),
      })
    }

    const category = categoryMap.get(importedCat.name)!
    let maxSubcategoryOrder =
      Math.max(0, ...Array.from(category.subcategories.values()).map((s) => s.displayOrder)) + 1

    for (const importedSubcat of importedCat.subcategories) {
      if (!category.subcategories.has(importedSubcat.name)) {
        // New subcategory
        category.subcategories.set(importedSubcat.name, {
          id: null,
          name: importedSubcat.name,
          displayOrder: maxSubcategoryOrder++,
          topics: new Map(),
        })
      }

      const subcategory = category.subcategories.get(importedSubcat.name)!
      let maxTopicOrder =
        Math.max(0, ...Array.from(subcategory.topics.values()).map((t) => t.displayOrder)) + 1

      for (const importedTopic of importedSubcat.topics) {
        if (!subcategory.topics.has(importedTopic.name)) {
          // New topic
          subcategory.topics.set(importedTopic.name, {
            id: null,
            name: importedTopic.name,
            displayOrder: maxTopicOrder++,
          })
        }
        // Existing topics are kept as-is (no update)
      }
    }
  }

  // Convert map back to tree
  const categories = Array.from(categoryMap.values())
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      displayOrder: cat.displayOrder,
      subcategories: Array.from(cat.subcategories.values())
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((subcat) => ({
          id: subcat.id,
          name: subcat.name,
          displayOrder: subcat.displayOrder,
          topics: Array.from(subcat.topics.values())
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((topic) => ({
              id: topic.id,
              name: topic.name,
              displayOrder: topic.displayOrder,
            })),
        })),
    }))

  return { categories }
}
