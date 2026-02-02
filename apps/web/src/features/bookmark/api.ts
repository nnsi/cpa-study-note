import { api } from "@/lib/api-client"
import {
  bookmarkListResponseSchema,
  messageResponseSchema,
  type BookmarkTargetType,
  type BookmarkWithDetails,
} from "@cpa-study/shared/schemas"

export type { BookmarkTargetType, BookmarkWithDetails }

export const getBookmarks = async (): Promise<{ bookmarks: BookmarkWithDetails[] }> => {
  const res = await api.api.bookmarks.$get()
  if (!res.ok) throw new Error("Failed to fetch bookmarks")
  const data = await res.json()
  return bookmarkListResponseSchema.parse(data)
}

export const addBookmark = async (
  targetType: BookmarkTargetType,
  targetId: string
): Promise<{ message: string }> => {
  const res = await api.api.bookmarks.$post({
    json: { targetType, targetId },
  })
  if (!res.ok) throw new Error("Failed to add bookmark")
  const data = await res.json()
  return messageResponseSchema.parse(data)
}

export const removeBookmark = async (
  targetType: BookmarkTargetType,
  targetId: string
): Promise<void> => {
  const res = await api.api.bookmarks[":targetType"][":targetId"].$delete({
    param: { targetType, targetId },
  })
  if (!res.ok) throw new Error("Failed to remove bookmark")
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
