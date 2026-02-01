import { readFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"

const DATA_DIR = join(process.cwd(), "data", "study-domains")

const generateId = () => crypto.randomUUID()

const now = new Date()

// Types for JSON data
type TopicJson = {
  name: string
  difficulty?: string
  topicType?: string
}

type SubcategoryJson = {
  id: string
  name: string
  displayOrder: number
  topics: TopicJson[]
}

type CategoryJson = {
  id: string
  name: string
  displayOrder: number
  subcategories: SubcategoryJson[]
}

type SubjectJson = {
  id: string
  name: string
  description: string | null
  emoji: string
  color: string
  displayOrder: number
  categories: CategoryJson[]
}

type DomainJson = {
  id: string
  name: string
  description: string | null
  emoji: string
  color: string
  isPublic: boolean
}

// DB row types
type StudyDomainData = {
  id: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  is_public: number
  created_at: Date
  updated_at: Date
}

type SubjectData = {
  id: string
  study_domain_id: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  display_order: number
  created_at: Date
  updated_at: Date
}

type CategoryData = {
  id: string
  subject_id: string
  name: string
  depth: number
  parent_id: string | null
  display_order: number
  created_at: Date
  updated_at: Date
}

type TopicData = {
  id: string
  category_id: string
  name: string
  description: string | null
  difficulty: string | null
  topic_type: string | null
  ai_system_prompt: string | null
  display_order: number
  created_at: Date
  updated_at: Date
}

type UserData = {
  id: string
  email: string
  name: string
  avatar_url: string | null
  default_study_domain_id: string | null
  created_at: Date
  updated_at: Date
}

type UserStudyDomainData = {
  id: string
  user_id: string
  study_domain_id: string
  joined_at: Date
}

const devUsers: UserData[] = [
  {
    id: "test-user-1",
    email: "test1@example.com",
    name: "テストユーザー1",
    avatar_url: null,
    default_study_domain_id: "cpa",
    created_at: now,
    updated_at: now,
  },
  {
    id: "test-user-2",
    email: "test2@example.com",
    name: "テストユーザー2",
    avatar_url: null,
    default_study_domain_id: "cpa",
    created_at: now,
    updated_at: now,
  },
  {
    id: "test-admin",
    email: "admin@example.com",
    name: "管理者テスト",
    avatar_url: null,
    default_study_domain_id: "cpa",
    created_at: now,
    updated_at: now,
  },
]

const loadDomainJson = (domainDir: string): DomainJson => {
  const domainPath = join(domainDir, "domain.json")
  const content = readFileSync(domainPath, "utf-8")
  return JSON.parse(content)
}

const loadSubjectJson = (subjectPath: string): SubjectJson => {
  const content = readFileSync(subjectPath, "utf-8")
  return JSON.parse(content)
}

const generateSeedData = () => {
  const studyDomains: StudyDomainData[] = []
  const subjects: SubjectData[] = []
  const categories: CategoryData[] = []
  const topics: TopicData[] = []
  const userStudyDomains: UserStudyDomainData[] = []

  // Scan study-domains directory
  if (!existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`)
    return { users: devUsers, studyDomains, userStudyDomains, subjects, categories, topics }
  }

  const domainDirs = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  for (const domainDirName of domainDirs) {
    const domainDir = join(DATA_DIR, domainDirName)

    // Load domain.json
    const domainJson = loadDomainJson(domainDir)
    studyDomains.push({
      id: domainJson.id,
      name: domainJson.name,
      description: domainJson.description,
      emoji: domainJson.emoji,
      color: domainJson.color,
      is_public: domainJson.isPublic ? 1 : 0,
      created_at: now,
      updated_at: now,
    })

    // Load subjects from subjects/ directory
    const subjectsDir = join(domainDir, "subjects")
    if (!existsSync(subjectsDir)) {
      continue
    }

    const subjectFiles = readdirSync(subjectsDir)
      .filter((f) => f.endsWith(".json"))

    for (const subjectFile of subjectFiles) {
      const subjectJson = loadSubjectJson(join(subjectsDir, subjectFile))
      const subjectId = `subject-${subjectJson.id}`

      subjects.push({
        id: subjectId,
        study_domain_id: domainJson.id,
        name: subjectJson.name,
        description: subjectJson.description,
        emoji: subjectJson.emoji,
        color: subjectJson.color,
        display_order: subjectJson.displayOrder,
        created_at: now,
        updated_at: now,
      })

      // Process categories (large categories = depth 1)
      for (const categoryJson of subjectJson.categories) {
        const largeCategoryId = generateId()

        categories.push({
          id: largeCategoryId,
          subject_id: subjectId,
          name: categoryJson.name,
          depth: 1,
          parent_id: null,
          display_order: categoryJson.displayOrder,
          created_at: now,
          updated_at: now,
        })

        // Process subcategories (medium categories = depth 2)
        for (const subcategoryJson of categoryJson.subcategories) {
          const mediumCategoryId = generateId()

          categories.push({
            id: mediumCategoryId,
            subject_id: subjectId,
            name: subcategoryJson.name,
            depth: 2,
            parent_id: largeCategoryId,
            display_order: subcategoryJson.displayOrder,
            created_at: now,
            updated_at: now,
          })

          // Process topics
          if (subcategoryJson.topics.length === 0) {
            // If no topics, the subcategory name itself becomes a topic
            topics.push({
              id: generateId(),
              category_id: mediumCategoryId,
              name: subcategoryJson.name,
              description: null,
              difficulty: null,
              topic_type: null,
              ai_system_prompt: null,
              display_order: 0,
              created_at: now,
              updated_at: now,
            })
          } else {
            // Create topics from the topics array
            let topicOrder = 0
            for (const topicJson of subcategoryJson.topics) {
              topics.push({
                id: generateId(),
                category_id: mediumCategoryId,
                name: topicJson.name,
                description: null,
                difficulty: topicJson.difficulty || null,
                topic_type: topicJson.topicType || null,
                ai_system_prompt: null,
                display_order: topicOrder++,
                created_at: now,
                updated_at: now,
              })
            }
          }
        }
      }
    }
  }

  // Create user_study_domains for dev users
  for (const user of devUsers) {
    userStudyDomains.push({
      id: generateId(),
      user_id: user.id,
      study_domain_id: "cpa",
      joined_at: now,
    })
  }

  return { users: devUsers, studyDomains, userStudyDomains, subjects, categories, topics }
}

const formatValue = (value: unknown): string => {
  if (value === null) return "NULL"
  if (value instanceof Date) return `${Math.floor(value.getTime() / 1000)}`
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return `'${JSON.stringify(value)}'`
  return String(value)
}

const generateInsertSQL = (table: string, data: Record<string, unknown>[], batchSize = 50): string => {
  if (data.length === 0) return ""

  const columns = Object.keys(data[0])
  let sql = ""

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)
    const values = batch.map((row) => {
      const rowValues = columns.map((col) => formatValue(row[col]))
      return `(${rowValues.join(", ")})`
    })
    sql += `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values.join(",\n")};\n\n`
  }

  return sql
}

const main = () => {
  const { users, studyDomains, userStudyDomains, subjects, categories, topics } = generateSeedData()

  let sql = "-- Seed data generated from JSON files\n\n"

  sql += "-- Study Domains\n"
  sql += generateInsertSQL("study_domains", studyDomains)

  sql += "-- Users\n"
  sql += generateInsertSQL("users", users)

  sql += "-- User Study Domains\n"
  sql += generateInsertSQL("user_study_domains", userStudyDomains)

  sql += "-- Subjects\n"
  sql += generateInsertSQL("subjects", subjects)

  sql += "-- Categories\n"
  sql += generateInsertSQL("categories", categories)

  sql += "-- Topics\n"
  sql += generateInsertSQL("topics", topics)

  console.log(sql)

  console.error(`\nGenerated seed data:`)
  console.error(`- Study Domains: ${studyDomains.length}`)
  console.error(`- Users: ${users.length}`)
  console.error(`- User Study Domains: ${userStudyDomains.length}`)
  console.error(`- Subjects: ${subjects.length}`)
  console.error(`- Categories: ${categories.length}`)
  console.error(`- Topics: ${topics.length}`)
}

main()
