import { eq, and, isNull, desc } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  topics,
  categories,
  subjects,
  studyDomains,
  userTopicProgress,
  notes,
  chatSessions,
} from "@cpa-study/db/schema"

export type TopicViewData = {
  topic: {
    id: string
    name: string
    description: string | null
    categoryId: string
    categoryName: string
    subjectId: string
    subjectName: string
    difficulty: string | null
    topicType: string | null
    displayOrder: number
    createdAt: Date
    updatedAt: Date
  }
  progress: {
    id: string
    userId: string
    topicId: string
    understood: boolean
    lastAccessedAt: Date | null
    questionCount: number
    goodQuestionCount: number
    createdAt: Date
    updatedAt: Date
  } | null
  recentNotes: Array<{
    id: string
    title: string | null
    updatedAt: Date
  }>
  recentSessions: Array<{
    id: string
    createdAt: Date
  }>
}

export type TopicViewRepository = {
  getTopicView: (topicId: string, userId: string) => Promise<TopicViewData | null>
}

export const createTopicViewRepository = (db: Db): TopicViewRepository => ({
  getTopicView: async (topicId, userId) => {
    // 1. Get topic with hierarchy (userId + deleted_at check)
    const topicResult = await db
      .select({
        id: topics.id,
        name: topics.name,
        description: topics.description,
        categoryId: topics.categoryId,
        categoryName: categories.name,
        subjectId: subjects.id,
        subjectName: subjects.name,
        difficulty: topics.difficulty,
        topicType: topics.topicType,
        displayOrder: topics.displayOrder,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(topics.id, topicId),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)

    const topic = topicResult[0]
    if (!topic) {
      return null
    }

    // 2. Get progress
    const progressResult = await db
      .select()
      .from(userTopicProgress)
      .where(
        and(
          eq(userTopicProgress.topicId, topicId),
          eq(userTopicProgress.userId, userId)
        )
      )
      .limit(1)

    const progress = progressResult[0] ?? null

    // 3. Get recent notes (最新5件)
    const recentNotes = await db
      .select({
        id: notes.id,
        title: notes.aiSummary, // aiSummary をタイトルとして使用
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(
        and(
          eq(notes.topicId, topicId),
          eq(notes.userId, userId),
          isNull(notes.deletedAt)
        )
      )
      .orderBy(desc(notes.updatedAt))
      .limit(5)

    // 4. Get recent sessions (最新5件)
    const recentSessions = await db
      .select({
        id: chatSessions.id,
        createdAt: chatSessions.createdAt,
      })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.topicId, topicId),
          eq(chatSessions.userId, userId)
        )
      )
      .orderBy(desc(chatSessions.createdAt))
      .limit(5)

    return {
      topic,
      progress,
      recentNotes,
      recentSessions,
    }
  },
})
