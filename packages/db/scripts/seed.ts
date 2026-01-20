import { readFileSync, readdirSync } from "fs"
import { join } from "path"

type CsvRow = {
  subjectName: string
  largeCategory: string
  mediumCategory: string
  smallCategory: string
}

const CSV_DIR = join(process.cwd(), "..", "..", "csv")

const generateId = () => crypto.randomUUID()

const now = new Date()

const parseCsv = (content: string): CsvRow[] => {
  const lines = content.trim().split("\n")
  const header = lines[0]
  const dataLines = lines.slice(1)

  return dataLines.map((line) => {
    const values = line.split(",").map((v) => v.trim())
    return {
      subjectName: values[0] || "",
      largeCategory: values[1] || "",
      mediumCategory: values[2] || "",
      smallCategory: values[3] || "",
    }
  })
}

const devUsers = [
  {
    id: "test-user-1",
    email: "test1@example.com",
    name: "テストユーザー1",
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "test-user-2",
    email: "test2@example.com",
    name: "テストユーザー2",
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "test-admin",
    email: "admin@example.com",
    name: "管理者テスト",
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
  },
]

const subjectSlugMap: Record<string, string> = {
  財務会計論: "financial",
  管理会計論: "management",
  監査論: "audit",
  企業法: "corporate",
  租税法: "tax",
  経営学: "business",
  経済学: "economics",
  民法: "civil",
}

type SubjectData = {
  id: string
  name: string
  description: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

type CategoryData = {
  id: string
  subjectId: string
  name: string
  depth: number
  parentId: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

type TopicData = {
  id: string
  categoryId: string
  name: string
  description: string | null
  difficulty: string | null
  topicType: string | null
  aiSystemPrompt: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

const generateSeedData = () => {
  const subjects: SubjectData[] = []
  const categories: CategoryData[] = []
  const topics: TopicData[] = []

  const subjectMap = new Map<string, string>()
  const largeCategoryMap = new Map<string, string>()
  const mediumCategoryMap = new Map<string, string>()

  const csvFiles = readdirSync(CSV_DIR).filter((f) => f.endsWith(".csv"))

  let subjectOrder = 0

  for (const csvFile of csvFiles) {
    const content = readFileSync(join(CSV_DIR, csvFile), "utf-8")
    const rows = parseCsv(content)

    let largeCategoryOrder = 0
    let mediumCategoryOrder = 0
    let topicOrder = 0

    for (const row of rows) {
      if (!row.subjectName || !row.largeCategory || !row.mediumCategory) continue

      // Subject
      if (!subjectMap.has(row.subjectName)) {
        const slug = subjectSlugMap[row.subjectName] || generateId()
        const subjectId = `subject-${slug}`
        subjectMap.set(row.subjectName, subjectId)
        subjects.push({
          id: subjectId,
          name: row.subjectName,
          description: null,
          displayOrder: subjectOrder++,
          createdAt: now,
          updatedAt: now,
        })
      }
      const subjectId = subjectMap.get(row.subjectName)!

      // Large Category (depth=1)
      const largeCategoryKey = `${subjectId}:${row.largeCategory}`
      if (!largeCategoryMap.has(largeCategoryKey)) {
        const categoryId = generateId()
        largeCategoryMap.set(largeCategoryKey, categoryId)
        categories.push({
          id: categoryId,
          subjectId,
          name: row.largeCategory,
          depth: 1,
          parentId: null,
          displayOrder: largeCategoryOrder++,
          createdAt: now,
          updatedAt: now,
        })
      }
      const largeCategoryId = largeCategoryMap.get(largeCategoryKey)!

      // Medium Category (depth=2)
      const mediumCategoryKey = `${largeCategoryId}:${row.mediumCategory}`
      if (!mediumCategoryMap.has(mediumCategoryKey)) {
        const categoryId = generateId()
        mediumCategoryMap.set(mediumCategoryKey, categoryId)
        categories.push({
          id: categoryId,
          subjectId,
          name: row.mediumCategory,
          depth: 2,
          parentId: largeCategoryId,
          displayOrder: mediumCategoryOrder++,
          createdAt: now,
          updatedAt: now,
        })
      }
      const mediumCategoryId = mediumCategoryMap.get(mediumCategoryKey)!

      // Topic (from small category or medium category itself)
      if (row.smallCategory) {
        const topicKey = `${mediumCategoryId}:${row.smallCategory}`
        const existingTopic = topics.find(
          (t) => t.categoryId === mediumCategoryId && t.name === row.smallCategory
        )
        if (!existingTopic) {
          topics.push({
            id: generateId(),
            categoryId: mediumCategoryId,
            name: row.smallCategory,
            description: null,
            difficulty: null,
            topicType: null,
            aiSystemPrompt: null,
            displayOrder: topicOrder++,
            createdAt: now,
            updatedAt: now,
          })
        }
      } else {
        // Medium category itself is a topic
        const existingTopic = topics.find(
          (t) => t.categoryId === mediumCategoryId && t.name === row.mediumCategory
        )
        if (!existingTopic) {
          topics.push({
            id: generateId(),
            categoryId: mediumCategoryId,
            name: row.mediumCategory,
            description: null,
            difficulty: null,
            topicType: null,
            aiSystemPrompt: null,
            displayOrder: topicOrder++,
            createdAt: now,
            updatedAt: now,
          })
        }
      }
    }
  }

  return { users: devUsers, subjects, categories, topics }
}

const formatValue = (value: unknown): string => {
  if (value === null) return "NULL"
  if (value instanceof Date) return `${Math.floor(value.getTime() / 1000)}`
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return `'${JSON.stringify(value)}'`
  return String(value)
}

const generateInsertSQL = (table: string, data: Record<string, unknown>[]): string => {
  if (data.length === 0) return ""

  const columns = Object.keys(data[0])
  const values = data.map((row) => {
    const rowValues = columns.map((col) => formatValue(row[col]))
    return `(${rowValues.join(", ")})`
  })

  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values.join(",\n")};\n\n`
}

const main = () => {
  const { users, subjects, categories, topics } = generateSeedData()

  let sql = "-- Seed data generated from CSV files\n\n"

  sql += generateInsertSQL("users", users)
  sql += generateInsertSQL("subjects", subjects)
  sql += generateInsertSQL("categories", categories)
  sql += generateInsertSQL("topics", topics)

  console.log(sql)

  console.error(`\nGenerated seed data:`)
  console.error(`- Users: ${users.length}`)
  console.error(`- Subjects: ${subjects.length}`)
  console.error(`- Categories: ${categories.length}`)
  console.error(`- Topics: ${topics.length}`)
}

main()
