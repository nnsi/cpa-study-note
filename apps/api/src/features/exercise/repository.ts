import { eq, and, desc, isNull } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { exercises, images, topics, categories, subjects, studyDomains } from "@cpa-study/db/schema"

export type Exercise = {
  id: string
  userId: string
  imageId: string
  topicId: string | null
  suggestedTopicIds: string[] | null
  markedAsUnderstood: boolean
  createdAt: Date
  confirmedAt: Date | null
}

export type ExerciseWithImage = {
  exerciseId: string
  imageId: string
  ocrText: string | null
  createdAt: Date
  markedAsUnderstood: boolean
}

export type TopicForSuggestion = {
  id: string
  name: string
  studyDomainId: string
  subjectId: string
  categoryId: string
  subjectName: string
}

export type CreateExerciseInput = {
  id: string
  userId: string
  imageId: string
  suggestedTopicIds: string[]
}

export type ExerciseRepository = {
  create: (data: CreateExerciseInput) => Promise<Exercise>
  findById: (id: string) => Promise<Exercise | null>
  findByIdWithOwnerCheck: (id: string, userId: string) => Promise<Exercise | null>
  confirm: (id: string, userId: string, topicId: string, markAsUnderstood: boolean) => Promise<Exercise | null>
  findByTopicId: (topicId: string, userId: string) => Promise<ExerciseWithImage[]>
  findTopicsForSuggestion: (userId: string, limit?: number) => Promise<TopicForSuggestion[]>
}

export const createExerciseRepository = (db: Db): ExerciseRepository => ({
  create: async (data) => {
    const now = new Date()

    await db.insert(exercises).values({
      id: data.id,
      userId: data.userId,
      imageId: data.imageId,
      topicId: null,
      suggestedTopicIds: JSON.stringify(data.suggestedTopicIds),
      markedAsUnderstood: false,
      createdAt: now,
      confirmedAt: null,
    })

    return {
      id: data.id,
      userId: data.userId,
      imageId: data.imageId,
      topicId: null,
      suggestedTopicIds: data.suggestedTopicIds,
      markedAsUnderstood: false,
      createdAt: now,
      confirmedAt: null,
    }
  },

  findById: async (id) => {
    const result = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, id))
      .limit(1)

    const row = result[0]
    if (!row) return null

    return {
      ...row,
      suggestedTopicIds: row.suggestedTopicIds ? JSON.parse(row.suggestedTopicIds) : null,
    }
  },

  findByIdWithOwnerCheck: async (id, userId) => {
    const result = await db
      .select()
      .from(exercises)
      .where(and(eq(exercises.id, id), eq(exercises.userId, userId)))
      .limit(1)

    const row = result[0]
    if (!row) return null

    return {
      ...row,
      suggestedTopicIds: row.suggestedTopicIds ? JSON.parse(row.suggestedTopicIds) : null,
    }
  },

  confirm: async (id, userId, topicId, markAsUnderstood) => {
    const now = new Date()

    try {
      await db
        .update(exercises)
        .set({
          topicId,
          markedAsUnderstood: markAsUnderstood,
          confirmedAt: now,
        })
        .where(and(eq(exercises.id, id), eq(exercises.userId, userId)))
    } catch (e) {
      // 外部キー制約違反（存在しないtopicId）
      if (e instanceof Error && e.message.includes("FOREIGN KEY")) {
        return null
      }
      throw e
    }

    const result = await db
      .select()
      .from(exercises)
      .where(and(eq(exercises.id, id), eq(exercises.userId, userId)))
      .limit(1)

    const row = result[0]
    if (!row) return null

    return {
      ...row,
      suggestedTopicIds: row.suggestedTopicIds ? JSON.parse(row.suggestedTopicIds) : null,
    }
  },

  findByTopicId: async (topicId, userId) => {
    const result = await db
      .select({
        exerciseId: exercises.id,
        imageId: exercises.imageId,
        ocrText: images.ocrText,
        createdAt: exercises.createdAt,
        markedAsUnderstood: exercises.markedAsUnderstood,
      })
      .from(exercises)
      .innerJoin(images, eq(exercises.imageId, images.id))
      .where(and(eq(exercises.topicId, topicId), eq(exercises.userId, userId)))
      .orderBy(desc(exercises.createdAt))

    return result
  },

  findTopicsForSuggestion: async (userId, limit = 100) => {
    const result = await db
      .select({
        id: topics.id,
        name: topics.name,
        studyDomainId: studyDomains.id,
        subjectId: subjects.id,
        categoryId: categories.id,
        subjectName: subjects.name,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(and(
        eq(topics.userId, userId),
        isNull(topics.deletedAt),
        isNull(categories.deletedAt),
        isNull(subjects.deletedAt),
        isNull(studyDomains.deletedAt)
      ))
      .limit(limit)

    return result
  },
})
