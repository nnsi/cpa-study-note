import { api } from "@/lib/api-client"
import {
  bookmarkListResponseSchema,
  bookmarkWithDetailsSchema,
  type BookmarkTargetType,
  type BookmarkWithDetails,
} from "@cpa-study/shared/schemas"
import { z } from "zod"

const addBookmarkResponseSchema = z.object({
  bookmark: bookmarkWithDetailsSchema,
})

export type { BookmarkTargetType, BookmarkWithDetails }

export const getBookmarks = async (): Promise<{ bookmarks: BookmarkWithDetails[] }> => {
  const res = await api.api.bookmarks.$get()
  if (!res.ok) throw new Error("ブックマークの取得に失敗しました")
  const data = await res.json()
  return bookmarkListResponseSchema.parse(data)
}

export const addBookmark = async (
  targetType: BookmarkTargetType,
  targetId: string
): Promise<{ bookmark: BookmarkWithDetails }> => {
  const res = await api.api.bookmarks.$post({
    json: { targetType, targetId },
  })
  if (!res.ok) throw new Error("ブックマークの追加に失敗しました")
  const data = await res.json()
  return addBookmarkResponseSchema.parse(data)
}

export const removeBookmark = async (
  targetType: BookmarkTargetType,
  targetId: string
): Promise<void> => {
  const res = await api.api.bookmarks[":targetType"][":targetId"].$delete({
    param: { targetType, targetId },
  })
  if (!res.ok) throw new Error("ブックマークの削除に失敗しました")
}

export const isBookmarked = (
  bookmarks: BookmarkWithDetails[],
  targetType: BookmarkTargetType,
  targetId: string
): boolean => {
  return bookmarks.some(
    (b) => b.targetType === targetType && b.targetId === targetId
  )
}
