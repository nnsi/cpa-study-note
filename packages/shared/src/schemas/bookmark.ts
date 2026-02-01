import { z } from "zod"

/**
 * ブックマーク対象の種類
 */
export const bookmarkTargetTypeSchema = z.enum(["subject", "category", "topic"])
export type BookmarkTargetType = z.infer<typeof bookmarkTargetTypeSchema>

/**
 * ブックマーク追加リクエスト
 */
export const addBookmarkRequestSchema = z.object({
  targetType: bookmarkTargetTypeSchema,
  targetId: z.string().min(1),
})
export type AddBookmarkRequest = z.infer<typeof addBookmarkRequestSchema>

/**
 * ブックマークレスポンス（単一）
 */
export const bookmarkResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  targetType: bookmarkTargetTypeSchema,
  targetId: z.string(),
  createdAt: z.string().datetime(),
})
export type BookmarkResponse = z.infer<typeof bookmarkResponseSchema>

/**
 * ブックマーク詳細（名前・パス情報付き）
 * 遷移に必要な階層ID（domainId, subjectId, categoryId）を含む
 */
export const bookmarkWithDetailsSchema = z.object({
  id: z.string(),
  targetType: bookmarkTargetTypeSchema,
  targetId: z.string(),
  name: z.string(),
  path: z.string(), // "科目名 > 中単元名" のような階層パス
  // 遷移用の階層ID
  domainId: z.string(),
  subjectId: z.string().nullable(), // subjectの場合はnull（targetIdがsubjectId）
  categoryId: z.string().nullable(), // subject/categoryの場合はnull
  createdAt: z.string().datetime(),
})
export type BookmarkWithDetails = z.infer<typeof bookmarkWithDetailsSchema>

/**
 * ブックマーク一覧レスポンス
 */
export const bookmarkListResponseSchema = z.object({
  bookmarks: z.array(bookmarkWithDetailsSchema),
})
export type BookmarkListResponse = z.infer<typeof bookmarkListResponseSchema>

/**
 * ブックマーク削除パラメータ
 */
export const deleteBookmarkParamsSchema = z.object({
  targetType: bookmarkTargetTypeSchema,
  targetId: z.string(),
})
export type DeleteBookmarkParams = z.infer<typeof deleteBookmarkParamsSchema>
