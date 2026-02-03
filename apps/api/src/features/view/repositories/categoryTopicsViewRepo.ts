import { eq, and, isNull, asc } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  topics,
  categories,
  subjects,
  studyDomains,
} from "@cpa-study/db/schema"

export type CategoryTopicsData = {
  category: {
    id: string
    name: string
  }
  topics: Array<{
    id: string
    name: string
    description: string | null
    displayOrder: number
  }>
}

export type CategoryTopicsViewRepo = {
  getCategoryTopics: (categoryId: string, userId: string) => Promise<CategoryTopicsData | null>
}

export const createCategoryTopicsViewRepo = (db: Db): CategoryTopicsViewRepo => ({
  getCategoryTopics: async (categoryId, userId) => {
    // 1. Get category (userId + deleted_at check)
    const categoryResult = await db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories)
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)

    const category = categoryResult[0]
    if (!category) {
      return null
    }

    // 2. Get topics for this category
    const topicsResult = await db
      .select({
        id: topics.id,
        name: topics.name,
        description: topics.description,
        displayOrder: topics.displayOrder,
      })
      .from(topics)
      .where(
        and(
          eq(topics.categoryId, categoryId),
          eq(topics.userId, userId),
          isNull(topics.deletedAt)
        )
      )
      .orderBy(asc(topics.displayOrder))

    return {
      category,
      topics: topicsResult,
    }
  },
})
