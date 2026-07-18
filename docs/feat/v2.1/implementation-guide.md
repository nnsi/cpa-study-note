# v2.1 実装ガイド

> 設計ドキュメント: [design.md](./design.md)

---

## 1. DBスキーマ

### 1.1 study_domains テーブル

```typescript
// packages/db/src/schema/studyDomain.ts
export const studyDomains = sqliteTable("study_domains", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  emoji: text("emoji"),
  color: text("color"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
})
```

### 1.2 subjects テーブル

```typescript
// packages/db/src/schema/topics.ts
export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  studyDomainId: text("study_domain_id").notNull().references(() => studyDomains.id),
  name: text("name").notNull(),
  description: text("description"),
  emoji: text("emoji"),
  color: text("color"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
})
```

### 1.3 categories テーブル

```typescript
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  subjectId: text("subject_id").notNull().references(() => subjects.id),
  name: text("name").notNull(),
  depth: integer("depth").notNull().default(1),
  parentId: text("parent_id").references(() => categories.id),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
})
```

### 1.4 topics テーブル

```typescript
export const topics = sqliteTable("topics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  categoryId: text("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(),
  description: text("description"),
  difficulty: text("difficulty"),
  topicType: text("topic_type"),
  aiSystemPrompt: text("ai_system_prompt"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
})
```

### 1.5 users テーブル（変更）

```typescript
// deletedAt を追加
export const users = sqliteTable("users", {
  // ... 既存カラム
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
})
```

---

## 2. Zodスキーマ

### 2.1 学習領域

```typescript
// packages/shared/src/schemas/studyDomain.ts
import { z } from "zod"

export const studyDomainSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  emoji: z.string().max(10).nullable(),
  color: z.string().max(50).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
})

export const createStudyDomainSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().max(10).optional(),
  color: z.string().max(50).optional(),
})

export const updateStudyDomainSchema = createStudyDomainSchema.partial()
```

### 2.2 ツリー更新リクエスト

```typescript
// packages/shared/src/schemas/tree.ts
import { z } from "zod"

const topicNodeSchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  difficulty: z.enum(["basic", "intermediate", "advanced"]).nullable().optional(),
  topicType: z.string().max(50).nullable().optional(),
  aiSystemPrompt: z.string().max(5000).nullable().optional(),
  displayOrder: z.number().int().min(0),
})

const subcategoryNodeSchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1).max(200),
  displayOrder: z.number().int().min(0),
  topics: z.array(topicNodeSchema),
})

const categoryNodeSchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1).max(200),
  displayOrder: z.number().int().min(0),
  subcategories: z.array(subcategoryNodeSchema),
})

export const updateTreeSchema = z.object({
  categories: z.array(categoryNodeSchema),
})

export type UpdateTreeInput = z.infer<typeof updateTreeSchema>
export type CategoryNode = z.infer<typeof categoryNodeSchema>
export type SubcategoryNode = z.infer<typeof subcategoryNodeSchema>
export type TopicNode = z.infer<typeof topicNodeSchema>
```

---

## 3. API実装例

### 3.1 学習領域 Repository

```typescript
// apps/api/src/features/study-domain/repository.ts
import { eq, and, isNull } from "drizzle-orm"

export type StudyDomainRepository = ReturnType<typeof createStudyDomainRepository>

export const createStudyDomainRepository = (db: DrizzleD1Database) => ({
  // 全てのfindでuserIdを必須に
  findByUserId: async (userId: string) => {
    return db
      .select()
      .from(studyDomains)
      .where(and(
        eq(studyDomains.userId, userId),
        isNull(studyDomains.deletedAt)
      ))
      .orderBy(studyDomains.createdAt)
  },

  // userIdを必須パラメータに
  findById: async (id: string, userId: string) => {
    const results = await db
      .select()
      .from(studyDomains)
      .where(and(
        eq(studyDomains.id, id),
        eq(studyDomains.userId, userId),
        isNull(studyDomains.deletedAt)
      ))
      .limit(1)
    return results[0] ?? null
  },

  create: async (data: { userId: string; name: string; description?: string; emoji?: string; color?: string }) => {
    const id = crypto.randomUUID()
    const now = new Date()
    await db.insert(studyDomains).values({
      id,
      userId: data.userId,
      name: data.name,
      description: data.description ?? null,
      emoji: data.emoji ?? null,
      color: data.color ?? null,
      createdAt: now,
      updatedAt: now,
    })
    return { id }
  },

  update: async (id: string, userId: string, data: Partial<{ name: string; description: string; emoji: string; color: string }>) => {
    await db
      .update(studyDomains)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(studyDomains.id, id),
        eq(studyDomains.userId, userId)
      ))
  },

  softDelete: async (id: string, userId: string) => {
    await db
      .update(studyDomains)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(studyDomains.id, id),
        eq(studyDomains.userId, userId)
      ))
  },
})
```

### 3.2 科目一覧取得（親の削除状態をJOINで確認）

```typescript
// apps/api/src/features/subject/repository.ts
findByStudyDomainId: async (studyDomainId: string, userId: string) => {
  return db
    .select({
      id: subjects.id,
      name: subjects.name,
      // ... other fields
    })
    .from(subjects)
    .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
    .where(and(
      eq(subjects.studyDomainId, studyDomainId),
      eq(subjects.userId, userId),
      isNull(subjects.deletedAt),
      isNull(studyDomains.deletedAt)  // 親の削除状態も確認
    ))
    .orderBy(subjects.displayOrder)
}
```

### 3.3 ツリー一括更新（差分更新方式）

```typescript
// apps/api/src/features/subject/usecase.ts
import type { UpdateTreeInput } from "@cpa-study/shared"

export const updateSubjectTree = async (
  deps: { db: DrizzleD1Database },
  userId: string,
  subjectId: string,
  tree: UpdateTreeInput
): Promise<Result<void, "NOT_FOUND" | "FORBIDDEN" | "INVALID_ID">> => {
  const { db } = deps
  const now = new Date()

  // 1. 科目の所有権確認
  const [subject] = await db
    .select()
    .from(subjects)
    .where(and(
      eq(subjects.id, subjectId),
      eq(subjects.userId, userId),
      isNull(subjects.deletedAt)
    ))
    .limit(1)

  if (!subject) return err("NOT_FOUND")

  // 2. リクエストのノードIDを収集
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

  // 3. リクエストで指定されたIDの所有権検証（CRITICAL: 他ユーザーのID上書き防止）
  if (requestCategoryIds.size > 0) {
    const validCategoryIds = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(
        inArray(categories.id, Array.from(requestCategoryIds)),
        eq(categories.userId, userId),
        eq(categories.subjectId, subjectId)
      ))

    const validCategoryIdSet = new Set(validCategoryIds.map(c => c.id))
    for (const id of requestCategoryIds) {
      if (!validCategoryIdSet.has(id)) {
        return err("INVALID_ID")  // 所有権のないID、または別科目のID
      }
    }
  }

  if (requestTopicIds.size > 0) {
    const validTopicIds = await db
      .select({ id: topics.id })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .where(and(
        inArray(topics.id, Array.from(requestTopicIds)),
        eq(topics.userId, userId),
        eq(categories.subjectId, subjectId)
      ))

    const validTopicIdSet = new Set(validTopicIds.map(t => t.id))
    for (const id of requestTopicIds) {
      if (!validTopicIdSet.has(id)) {
        return err("INVALID_ID")  // 所有権のないID、または別科目のID
      }
    }
  }

  // 5. バッチ操作を構築
  const batchOps: BatchItem<"sqlite">[] = []

  // 5a. 既存カテゴリでリクエストに含まれないものをソフト削除
  const existingCategories = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(
      eq(categories.subjectId, subjectId),
      eq(categories.userId, userId),
      isNull(categories.deletedAt)
    ))

  for (const cat of existingCategories) {
    if (!requestCategoryIds.has(cat.id)) {
      batchOps.push(
        db.update(categories)
          .set({ deletedAt: now })
          .where(eq(categories.id, cat.id))
      )
    }
  }

  // 5b. 既存トピックでリクエストに含まれないものをソフト削除
  const existingTopics = await db
    .select({ id: topics.id })
    .from(topics)
    .innerJoin(categories, eq(topics.categoryId, categories.id))
    .where(and(
      eq(categories.subjectId, subjectId),
      eq(topics.userId, userId),
      isNull(topics.deletedAt)
    ))

  for (const topic of existingTopics) {
    if (!requestTopicIds.has(topic.id)) {
      batchOps.push(
        db.update(topics)
          .set({ deletedAt: now })
          .where(eq(topics.id, topic.id))
      )
    }
  }

  // 5c. カテゴリとトピックをupsert
  for (const cat of tree.categories) {
    const categoryId = cat.id ?? crypto.randomUUID()

    batchOps.push(
      db.insert(categories)
        .values({
          id: categoryId,
          userId,
          subjectId,
          name: cat.name,
          depth: 1,
          parentId: null,
          displayOrder: cat.displayOrder,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,  // 復活させる
        })
        .onConflictDoUpdate({
          target: categories.id,
          set: {
            name: cat.name,
            displayOrder: cat.displayOrder,
            updatedAt: now,
            deletedAt: null,
          },
        })
    )

    for (const subcat of cat.subcategories) {
      const subcategoryId = subcat.id ?? crypto.randomUUID()

      batchOps.push(
        db.insert(categories)
          .values({
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
          .onConflictDoUpdate({
            target: categories.id,
            set: {
              name: subcat.name,
              parentId: categoryId,
              displayOrder: subcat.displayOrder,
              updatedAt: now,
              deletedAt: null,
            },
          })
      )

      for (const topic of subcat.topics) {
        const topicId = topic.id ?? crypto.randomUUID()

        batchOps.push(
          db.insert(topics)
            .values({
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
            .onConflictDoUpdate({
              target: topics.id,
              set: {
                categoryId: subcategoryId,
                name: topic.name,
                description: topic.description ?? null,
                difficulty: topic.difficulty ?? null,
                topicType: topic.topicType ?? null,
                aiSystemPrompt: topic.aiSystemPrompt ?? null,
                displayOrder: topic.displayOrder,
                updatedAt: now,
                deletedAt: null,
              },
            })
        )
      }
    }
  }

  // 6. 全操作をatomicに実行
  // Note: D1のbatch()はアトミック実行を保証（失敗時は全ロールバック）
  // https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#batch-statements
  await db.batch(batchOps)

  return ok(undefined)
}
```

---

## 4. CSVインポート（RFC 4180準拠）

### 4.1 CSV形式

```csv
大単元,中単元,論点
財務会計の基礎概念,会計公準,企業実体の公準
財務会計の基礎概念,会計公準,継続企業の公準
"カンマ,を含む単元","引用符""を含む",論点名
```

### 4.2 パーサー（RFC 4180準拠）

```typescript
// apps/api/src/features/subject/csv-parser.ts

type ParsedRow = {
  largeCategory: string
  mediumCategory: string
  topic: string
}

type ParseResult = {
  rows: ParsedRow[]
  errors: Array<{ line: number; message: string }>
}

/**
 * RFC 4180準拠のCSVパーサー
 * - ダブルクォートでフィールドをエスケープ
 * - フィールド内のダブルクォートは""でエスケープ
 * - 改行を含むフィールドもサポート
 */
export const parseCSV = (csvContent: string): ParseResult => {
  const rows: ParsedRow[] = []
  const errors: Array<{ line: number; message: string }> = []

  const lines = splitCSVLines(csvContent)

  // ヘッダー行をスキップ
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue  // 空行スキップ

    const fields = parseCSVLine(line)

    if (fields.length < 3) {
      errors.push({ line: i + 1, message: "3列必要です（大単元, 中単元, 論点）" })
      continue
    }

    const [large, medium, topic] = fields.map(f => f.trim())

    if (!large || !medium || !topic) {
      errors.push({ line: i + 1, message: "空のフィールドがあります" })
      continue
    }

    rows.push({ largeCategory: large, mediumCategory: medium, topic })
  }

  return { rows, errors }
}

/**
 * CSVを行に分割（クォート内の改行を考慮）
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
    } else if ((char === '\n' || char === '\r') && !inQuote) {
      if (char === '\r' && content[i + 1] === '\n') {
        i++  // CRLF
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
 * CSV行をフィールドに分割（RFC 4180準拠）
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
          // エスケープされたダブルクォート
          current += '"'
          i++
        } else {
          // クォート終了
          inQuote = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuote = true
      } else if (char === ',') {
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
 * パース結果をツリー構造に変換
 */
export const convertToTree = (rows: ParsedRow[]): UpdateTreeInput => {
  const categoryMap = new Map<string, {
    name: string
    subcategories: Map<string, { name: string; topics: string[] }>
  }>()

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

    // 重複を避ける
    if (!subcategory.topics.includes(row.topic)) {
      subcategory.topics.push(row.topic)
    }
  }

  // ツリー形式に変換
  let categoryOrder = 0
  const categories = Array.from(categoryMap.values()).map(cat => {
    let subcategoryOrder = 0
    return {
      id: null,
      name: cat.name,
      displayOrder: categoryOrder++,
      subcategories: Array.from(cat.subcategories.values()).map(subcat => {
        let topicOrder = 0
        return {
          id: null,
          name: subcat.name,
          displayOrder: subcategoryOrder++,
          topics: subcat.topics.map(topicName => ({
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
```

### 4.3 インポートUseCase

```typescript
// apps/api/src/features/subject/usecase.ts

type ImportResult = {
  success: boolean
  imported: {
    categories: number
    subcategories: number
    topics: number
  }
  errors: Array<{ line: number; message: string }>
}

export const importCSV = async (
  deps: { db: DrizzleD1Database },
  userId: string,
  subjectId: string,
  csvContent: string
): Promise<Result<ImportResult, "NOT_FOUND" | "FORBIDDEN">> => {
  // 1. 科目の所有権確認
  const [subject] = await deps.db
    .select()
    .from(subjects)
    .where(and(
      eq(subjects.id, subjectId),
      eq(subjects.userId, userId),
      isNull(subjects.deletedAt)
    ))
    .limit(1)

  if (!subject) return err("NOT_FOUND")

  // 2. CSVパース
  const { rows, errors } = parseCSV(csvContent)

  if (rows.length === 0) {
    return ok({
      success: false,
      imported: { categories: 0, subcategories: 0, topics: 0 },
      errors: errors.length > 0 ? errors : [{ line: 0, message: "インポートするデータがありません" }],
    })
  }

  // 3. ツリー構造に変換
  const tree = convertToTree(rows)

  // 4. 既存データとマージ（追加モード）
  const existingTree = await getSubjectTree(deps, userId, subjectId)
  const mergedTree = mergeTree(existingTree, tree)

  // 5. ツリー更新
  await updateSubjectTree(deps, userId, subjectId, mergedTree)

  // 6. 結果集計
  let categoryCount = 0
  let subcategoryCount = 0
  let topicCount = 0

  for (const cat of tree.categories) {
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
```

---

## 5. 新規ユーザーサンプル作成

### 5.1 サンプルデータ定義

```typescript
// apps/api/src/features/auth/sample-data.ts
export const SAMPLE_DATA = {
  studyDomain: {
    name: "サンプル学習領域",
    description: "学習の始め方を体験できるサンプルです。自由に編集・削除してください。",
    emoji: "📚",
    color: "indigo",
  },
  subject: {
    name: "サンプル科目",
    description: "科目の説明を入力できます",
    emoji: "📘",
    color: "blue",
  },
  tree: {
    categories: [
      {
        id: null,
        name: "サンプル大単元",
        displayOrder: 0,
        subcategories: [
          {
            id: null,
            name: "サンプル中単元",
            displayOrder: 0,
            topics: [
              { id: null, name: "サンプル論点1", displayOrder: 0 },
              { id: null, name: "サンプル論点2", displayOrder: 1 },
            ],
          },
        ],
      },
    ],
  },
}
```

### 5.2 作成処理

```typescript
// apps/api/src/features/auth/usecase.ts

export const createSampleDataForNewUser = async (
  deps: {
    studyDomainRepo: StudyDomainRepository
    subjectRepo: SubjectRepository
    db: DrizzleD1Database
  },
  userId: string
): Promise<void> => {
  // 1. 学習領域作成
  const { id: domainId } = await deps.studyDomainRepo.create({
    userId,
    ...SAMPLE_DATA.studyDomain,
  })

  // 2. 科目作成
  const { id: subjectId } = await deps.subjectRepo.create({
    userId,
    studyDomainId: domainId,
    ...SAMPLE_DATA.subject,
  })

  // 3. ツリー（単元・論点）作成
  await updateSubjectTree(
    { db: deps.db },
    userId,
    subjectId,
    SAMPLE_DATA.tree
  )
}

// handleOAuthCallbackでの呼び出し
export const handleOAuthCallback = async (
  deps: AuthDeps,
  providerName: string,
  code: string
): Promise<Result<{ user: User; isNewUser: boolean }, AuthError>> => {
  // ... 既存の認証処理 ...

  if (isNewUser) {
    // 新規ユーザーにサンプルデータを作成
    await createSampleDataForNewUser(deps, newUser.id)
  }

  return ok({ user: newUser, isNewUser })
}
```

---

## 6. テスト例

### 6.1 Repository テスト

```typescript
// apps/api/src/features/study-domain/repository.test.ts
describe("StudyDomainRepository", () => {
  describe("findByUserId", () => {
    it("should return only domains owned by the user", async () => {
      // Arrange
      const user1 = await createTestUser(db)
      const user2 = await createTestUser(db)
      await createTestStudyDomain(db, user1.id, { name: "User1 Domain" })
      await createTestStudyDomain(db, user2.id, { name: "User2 Domain" })

      // Act
      const result = await repo.findByUserId(user1.id)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("User1 Domain")
    })

    it("should not return soft-deleted domains", async () => {
      // Arrange
      const user = await createTestUser(db)
      await createTestStudyDomain(db, user.id, { name: "Active" })
      await createTestStudyDomain(db, user.id, { name: "Deleted", deletedAt: new Date() })

      // Act
      const result = await repo.findByUserId(user.id)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("Active")
    })
  })

  describe("findById", () => {
    it("should return domain if owned by user", async () => {
      const user = await createTestUser(db)
      const domain = await createTestStudyDomain(db, user.id)

      const result = await repo.findById(domain.id, user.id)

      expect(result).not.toBeNull()
      expect(result!.id).toBe(domain.id)
    })

    it("should return null if owned by different user", async () => {
      const user1 = await createTestUser(db)
      const user2 = await createTestUser(db)
      const domain = await createTestStudyDomain(db, user1.id)

      const result = await repo.findById(domain.id, user2.id)

      expect(result).toBeNull()
    })

    it("should return null if soft-deleted", async () => {
      const user = await createTestUser(db)
      const domain = await createTestStudyDomain(db, user.id, { deletedAt: new Date() })

      const result = await repo.findById(domain.id, user.id)

      expect(result).toBeNull()
    })
  })

  describe("softDelete", () => {
    it("should set deletedAt timestamp", async () => {
      const user = await createTestUser(db)
      const domain = await createTestStudyDomain(db, user.id)

      await repo.softDelete(domain.id, user.id)

      const deleted = await db.select().from(studyDomains).where(eq(studyDomains.id, domain.id))
      expect(deleted[0].deletedAt).not.toBeNull()
    })
  })
})
```

### 6.2 科目一覧取得テスト（親の削除状態確認）

```typescript
describe("SubjectRepository", () => {
  describe("findByStudyDomainId", () => {
    it("should not return subjects if parent domain is soft-deleted", async () => {
      const user = await createTestUser(db)
      const domain = await createTestStudyDomain(db, user.id, { deletedAt: new Date() })
      await createTestSubject(db, user.id, domain.id, { name: "Subject" })

      const result = await repo.findByStudyDomainId(domain.id, user.id)

      expect(result).toHaveLength(0)
    })
  })
})
```

### 6.3 ツリー更新テスト

```typescript
describe("updateSubjectTree", () => {
  it("should reject request containing another user's category ID", async () => {
    const user1 = await createTestUser(db)
    const user2 = await createTestUser(db)
    const domain1 = await createTestStudyDomain(db, user1.id)
    const domain2 = await createTestStudyDomain(db, user2.id)
    const subject1 = await createTestSubject(db, user1.id, domain1.id)
    const subject2 = await createTestSubject(db, user2.id, domain2.id)
    const category2 = await createTestCategory(db, user2.id, subject2.id)

    // user1がuser2のカテゴリIDを含めてリクエスト
    const result = await updateSubjectTree(
      { db },
      user1.id,
      subject1.id,
      {
        categories: [{
          id: category2.id,  // user2のカテゴリID
          name: "Hijacked",
          displayOrder: 0,
          subcategories: [],
        }],
      }
    )

    expect(result.ok).toBe(false)
    expect(result.error).toBe("INVALID_ID")
  })

  it("should reject request containing category from different subject", async () => {
    const user = await createTestUser(db)
    const domain = await createTestStudyDomain(db, user.id)
    const subject1 = await createTestSubject(db, user.id, domain.id)
    const subject2 = await createTestSubject(db, user.id, domain.id)
    const category2 = await createTestCategory(db, user.id, subject2.id)

    // subject1のツリー更新にsubject2のカテゴリIDを含めてリクエスト
    const result = await updateSubjectTree(
      { db },
      user.id,
      subject1.id,
      {
        categories: [{
          id: category2.id,  // subject2のカテゴリID
          name: "Wrong Subject",
          displayOrder: 0,
          subcategories: [],
        }],
      }
    )

    expect(result.ok).toBe(false)
    expect(result.error).toBe("INVALID_ID")
  })

  it("should soft-delete nodes not in request", async () => {
    const user = await createTestUser(db)
    const domain = await createTestStudyDomain(db, user.id)
    const subject = await createTestSubject(db, user.id, domain.id)
    const category = await createTestCategory(db, user.id, subject.id, { name: "ToDelete" })

    await updateSubjectTree(
      { db },
      user.id,
      subject.id,
      { categories: [] }  // 空のツリー
    )

    const deleted = await db.select().from(categories).where(eq(categories.id, category.id))
    expect(deleted[0].deletedAt).not.toBeNull()
  })

  it("should revive soft-deleted nodes if id is provided", async () => {
    const user = await createTestUser(db)
    const domain = await createTestStudyDomain(db, user.id)
    const subject = await createTestSubject(db, user.id, domain.id)
    const category = await createTestCategory(db, user.id, subject.id, {
      name: "Deleted",
      deletedAt: new Date(),
    })

    await updateSubjectTree(
      { db },
      user.id,
      subject.id,
      { categories: [{ id: category.id, name: "Revived", displayOrder: 0, subcategories: [] }] }
    )

    const revived = await db.select().from(categories).where(eq(categories.id, category.id))
    expect(revived[0].deletedAt).toBeNull()
    expect(revived[0].name).toBe("Revived")
  })
})
```

---

## 7. マイグレーションSQL

```sql
-- Step 1: users に deletedAt 追加
ALTER TABLE users ADD COLUMN deleted_at INTEGER;

-- Step 2: study_domains 再作成（userId, deletedAt追加、isPublic削除）
CREATE TABLE study_domains_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- Step 3: 既存データは移行しない（クリーンスタート）
DROP TABLE study_domains;
ALTER TABLE study_domains_new RENAME TO study_domains;

-- Step 4: インデックス作成
CREATE INDEX study_domains_user_id_idx ON study_domains(user_id);
CREATE INDEX study_domains_user_deleted_idx ON study_domains(user_id, deleted_at);

-- Step 5: subjects, categories, topics も同様に再作成
-- （userId, deletedAt追加）
-- 削除順序: topics → categories → subjects → study_domains

-- Step 6: user_study_domains テーブル削除
DROP TABLE user_study_domains;
```
