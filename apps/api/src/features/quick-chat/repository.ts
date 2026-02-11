import { eq, and, isNull } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  subjects,
  categories,
  topics,
  studyDomains,
} from "@cpa-study/db/schema"

export type TopicForSuggest = {
  topicId: string
  topicName: string
  categoryId: string
  categoryName: string
  subjectId: string
  subjectName: string
}

export type QuickChatRepository = {
  findAllTopicsByDomain: (domainId: string, userId: string) => Promise<TopicForSuggest[]>
}

export const createQuickChatRepository = (db: Db): QuickChatRepository => ({
  findAllTopicsByDomain: async (domainId, userId) => {
    const result = await db
      .select({
        topicId: topics.id,
        topicName: topics.name,
        categoryId: categories.id,
        categoryName: categories.name,
        subjectId: subjects.id,
        subjectName: subjects.name,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(studyDomains.id, domainId),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .orderBy(subjects.displayOrder, categories.displayOrder, topics.displayOrder)

    return result
  },
})
