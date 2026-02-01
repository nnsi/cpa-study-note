import type { Db } from "@cpa-study/db"
import { studyDomains, subjects, categories, topics } from "@cpa-study/db/schema"

/**
 * Create sample data for a new user
 * This gives them something to start with and demonstrates the app's structure
 */
export const createSampleDataForNewUser = async (
  db: Db,
  userId: string
): Promise<{ studyDomainId: string; subjectId: string }> => {
  const now = new Date()

  // 1. Create sample study domain
  const studyDomainId = crypto.randomUUID()
  await db.insert(studyDomains).values({
    id: studyDomainId,
    userId,
    name: "サンプル学習領域",
    description: "これはサンプルの学習領域です。自由に編集・削除できます。",
    emoji: "📚",
    color: "indigo",
    createdAt: now,
    updatedAt: now,
  })

  // 2. Create sample subject
  const subjectId = crypto.randomUUID()
  await db.insert(subjects).values({
    id: subjectId,
    userId,
    studyDomainId,
    name: "サンプル科目",
    description: "これはサンプルの科目です。単元・論点を追加してみましょう。",
    emoji: "📘",
    color: "jade",
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  })

  // 3. Create sample categories (depth=1: 大単元)
  const categoryId1 = crypto.randomUUID()
  const categoryId2 = crypto.randomUUID()
  await db.insert(categories).values([
    {
      id: categoryId1,
      userId,
      subjectId,
      name: "サンプル大単元1",
      depth: 1,
      parentId: null,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: categoryId2,
      userId,
      subjectId,
      name: "サンプル大単元2",
      depth: 1,
      parentId: null,
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
  ])

  // 4. Create sample subcategories (depth=2: 中単元)
  const subcategoryId1 = crypto.randomUUID()
  const subcategoryId2 = crypto.randomUUID()
  const subcategoryId3 = crypto.randomUUID()
  await db.insert(categories).values([
    {
      id: subcategoryId1,
      userId,
      subjectId,
      name: "サンプル中単元1-1",
      depth: 2,
      parentId: categoryId1,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: subcategoryId2,
      userId,
      subjectId,
      name: "サンプル中単元1-2",
      depth: 2,
      parentId: categoryId1,
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: subcategoryId3,
      userId,
      subjectId,
      name: "サンプル中単元2-1",
      depth: 2,
      parentId: categoryId2,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
  ])

  // 5. Create sample topics
  await db.insert(topics).values([
    {
      id: crypto.randomUUID(),
      userId,
      categoryId: subcategoryId1,
      name: "サンプル論点A",
      description: "これはサンプルの論点です。チャットやノートで学習できます。",
      difficulty: "basic",
      topicType: null,
      aiSystemPrompt: null,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      userId,
      categoryId: subcategoryId1,
      name: "サンプル論点B",
      description: null,
      difficulty: "intermediate",
      topicType: null,
      aiSystemPrompt: null,
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      userId,
      categoryId: subcategoryId2,
      name: "サンプル論点C",
      description: null,
      difficulty: "advanced",
      topicType: null,
      aiSystemPrompt: null,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      userId,
      categoryId: subcategoryId3,
      name: "サンプル論点D",
      description: "CSVインポートやツリーエディタで論点を追加できます。",
      difficulty: "basic",
      topicType: null,
      aiSystemPrompt: null,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
  ])

  return { studyDomainId, subjectId }
}
