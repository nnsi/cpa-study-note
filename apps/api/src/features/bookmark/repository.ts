import { eq, and } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { userBookmarks, subjects, categories, topics } from "@cpa-study/db/schema"
import type { BookmarkTargetType } from "@cpa-study/db/schema"

export type Bookmark = {
  id: string
  userId: string
  targetType: BookmarkTargetType
  targetId: string
  createdAt: Date
}

export type BookmarkDetails = {
  name: string
  path: string
  domainId: string
  subjectId: string | null
  categoryId: string | null
}

export type BookmarkRepository = {
  findBookmarksByUser: (userId: string) => Promise<Bookmark[]>
  addBookmark: (
    userId: string,
    targetType: BookmarkTargetType,
    targetId: string
  ) => Promise<{ bookmark: Bookmark | null; alreadyExists: boolean }>
  removeBookmark: (
    userId: string,
    targetType: BookmarkTargetType,
    targetId: string
  ) => Promise<boolean>
  isBookmarked: (
    userId: string,
    targetType: BookmarkTargetType,
    targetId: string
  ) => Promise<boolean>
  targetExists: (
    targetType: BookmarkTargetType,
    targetId: string
  ) => Promise<boolean>
  getBookmarkDetails: (
    targetType: BookmarkTargetType,
    targetId: string
  ) => Promise<BookmarkDetails | null>
}

export const createBookmarkRepository = (db: Db): BookmarkRepository => ({
  findBookmarksByUser: async (userId) => {
    return db
      .select()
      .from(userBookmarks)
      .where(eq(userBookmarks.userId, userId))
      .orderBy(userBookmarks.createdAt)
  },

  addBookmark: async (userId, targetType, targetId) => {
    const id = crypto.randomUUID()
    const now = new Date()

    const bookmark = {
      id,
      userId,
      targetType,
      targetId,
      createdAt: now,
    }

    try {
      // onConflictDoNothing で重複登録を冪等に処理
      await db
        .insert(userBookmarks)
        .values(bookmark)
        .onConflictDoNothing({
          target: [userBookmarks.userId, userBookmarks.targetType, userBookmarks.targetId],
        })

      // 挿入が成功したか確認（onConflictDoNothingで無視された場合もエラーにならない）
      // 挿入後に存在確認で判定
      const inserted = await db
        .select({ id: userBookmarks.id })
        .from(userBookmarks)
        .where(eq(userBookmarks.id, id))
        .limit(1)

      if (inserted.length === 0) {
        // 新しいIDで挿入されなかった = 既存のブックマークがある
        return { bookmark: null, alreadyExists: true }
      }

      return { bookmark, alreadyExists: false }
    } catch (error) {
      // UNIQUE制約違反をキャッチ（万が一onConflictDoNothingが効かない場合）
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        return { bookmark: null, alreadyExists: true }
      }
      throw error
    }
  },

  removeBookmark: async (userId, targetType, targetId) => {
    // Check if bookmark exists first
    const existing = await db
      .select({ id: userBookmarks.id })
      .from(userBookmarks)
      .where(
        and(
          eq(userBookmarks.userId, userId),
          eq(userBookmarks.targetType, targetType),
          eq(userBookmarks.targetId, targetId)
        )
      )
      .limit(1)

    if (existing.length === 0) {
      return false
    }

    await db
      .delete(userBookmarks)
      .where(
        and(
          eq(userBookmarks.userId, userId),
          eq(userBookmarks.targetType, targetType),
          eq(userBookmarks.targetId, targetId)
        )
      )

    return true
  },

  isBookmarked: async (userId, targetType, targetId) => {
    const result = await db
      .select()
      .from(userBookmarks)
      .where(
        and(
          eq(userBookmarks.userId, userId),
          eq(userBookmarks.targetType, targetType),
          eq(userBookmarks.targetId, targetId)
        )
      )
      .limit(1)

    return result.length > 0
  },

  // 対象が存在するかチェック
  targetExists: async (targetType, targetId) => {
    switch (targetType) {
      case "subject": {
        const result = await db
          .select({ id: subjects.id })
          .from(subjects)
          .where(eq(subjects.id, targetId))
          .limit(1)
        return result.length > 0
      }
      case "category": {
        const result = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.id, targetId))
          .limit(1)
        return result.length > 0
      }
      case "topic": {
        const result = await db
          .select({ id: topics.id })
          .from(topics)
          .where(eq(topics.id, targetId))
          .limit(1)
        return result.length > 0
      }
      default:
        return false
    }
  },

  // ブックマーク対象の詳細情報を取得（遷移用の階層IDを含む）
  getBookmarkDetails: async (targetType, targetId) => {
    switch (targetType) {
      case "subject": {
        const result = await db
          .select({
            name: subjects.name,
            domainId: subjects.studyDomainId,
          })
          .from(subjects)
          .where(eq(subjects.id, targetId))
          .limit(1)

        if (result.length === 0) return null

        return {
          name: result[0].name,
          path: result[0].name,
          domainId: result[0].domainId,
          subjectId: null, // subjectの場合、targetIdがsubjectId
          categoryId: null,
        }
      }

      case "category": {
        const result = await db
          .select({
            categoryName: categories.name,
            subjectId: subjects.id,
            subjectName: subjects.name,
            domainId: subjects.studyDomainId,
          })
          .from(categories)
          .innerJoin(subjects, eq(categories.subjectId, subjects.id))
          .where(eq(categories.id, targetId))
          .limit(1)

        if (result.length === 0) return null

        return {
          name: result[0].categoryName,
          path: `${result[0].subjectName} > ${result[0].categoryName}`,
          domainId: result[0].domainId,
          subjectId: result[0].subjectId,
          categoryId: null, // categoryの場合、targetIdがcategoryId
        }
      }

      case "topic": {
        const result = await db
          .select({
            topicName: topics.name,
            categoryId: categories.id,
            categoryName: categories.name,
            subjectId: subjects.id,
            subjectName: subjects.name,
            domainId: subjects.studyDomainId,
          })
          .from(topics)
          .innerJoin(categories, eq(topics.categoryId, categories.id))
          .innerJoin(subjects, eq(categories.subjectId, subjects.id))
          .where(eq(topics.id, targetId))
          .limit(1)

        if (result.length === 0) return null

        return {
          name: result[0].topicName,
          path: `${result[0].subjectName} > ${result[0].categoryName} > ${result[0].topicName}`,
          domainId: result[0].domainId,
          subjectId: result[0].subjectId,
          categoryId: result[0].categoryId,
        }
      }

      default:
        return null
    }
  },
})
