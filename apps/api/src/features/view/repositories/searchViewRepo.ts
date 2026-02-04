import { eq, and, isNull, like, sql, asc } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  topics,
  categories,
  subjects,
  studyDomains,
} from "@cpa-study/db/schema"
import type { SearchTopicsResponse } from "@cpa-study/shared/schemas"

export type SearchViewRepo = {
  searchTopics: (
    userId: string,
    query: string,
    studyDomainId?: string,
    limit?: number
  ) => Promise<SearchTopicsResponse>
}

export const createSearchViewRepo = (db: Db): SearchViewRepo => ({
  searchTopics: async (userId, query, studyDomainId, limit = 20) => {
    // Build conditions
    const conditions = [
      eq(topics.userId, userId),
      isNull(topics.deletedAt),
      isNull(categories.deletedAt),
      isNull(subjects.deletedAt),
      isNull(studyDomains.deletedAt),
      like(topics.name, `%${query}%`),
    ]

    if (studyDomainId) {
      conditions.push(eq(studyDomains.id, studyDomainId))
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(and(...conditions))

    const total = countResult[0]?.count ?? 0

    // Get results
    const results = await db
      .select({
        id: topics.id,
        name: topics.name,
        subjectId: subjects.id,
        subjectName: subjects.name,
        categoryId: categories.id,
        categoryName: categories.name,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(and(...conditions))
      .orderBy(asc(topics.name))
      .limit(limit)

    return { results, total }
  },
})
