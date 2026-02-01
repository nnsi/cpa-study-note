import type { BookmarkTargetType } from "@cpa-study/db/schema"
import type { BookmarkRepository } from "./repository"
import type { BookmarkWithDetails } from "@cpa-study/shared/schemas"

type BookmarkDeps = {
  repo: BookmarkRepository
}

// ブックマーク一覧を詳細情報付きで取得
export const getBookmarks = async (
  deps: BookmarkDeps,
  userId: string
): Promise<BookmarkWithDetails[]> => {
  const { repo } = deps
  const bookmarks = await repo.findBookmarksByUser(userId)

  // ブックマークの詳細情報を取得
  const bookmarksWithDetails: BookmarkWithDetails[] = []

  for (const bookmark of bookmarks) {
    const details = await repo.getBookmarkDetails(bookmark.targetType, bookmark.targetId)

    if (details) {
      bookmarksWithDetails.push({
        id: bookmark.id,
        targetType: bookmark.targetType,
        targetId: bookmark.targetId,
        name: details.name,
        path: details.path,
        domainId: details.domainId,
        subjectId: details.subjectId,
        categoryId: details.categoryId,
        createdAt: bookmark.createdAt.toISOString(),
      })
    }
  }

  return bookmarksWithDetails
}

// ブックマーク追加
export const addBookmark = async (
  deps: BookmarkDeps,
  userId: string,
  targetType: BookmarkTargetType,
  targetId: string
): Promise<{ success: boolean; alreadyExists?: boolean }> => {
  const { repo } = deps

  // 対象が存在するか確認
  const exists = await repo.targetExists(targetType, targetId)
  if (!exists) {
    return { success: false }
  }

  // ブックマーク追加（冪等、重複は無視）
  const result = await repo.addBookmark(userId, targetType, targetId)

  if (result.alreadyExists) {
    return { success: true, alreadyExists: true }
  }

  return { success: true }
}

// ブックマーク削除
export const removeBookmark = async (
  deps: BookmarkDeps,
  userId: string,
  targetType: BookmarkTargetType,
  targetId: string
): Promise<boolean> => {
  const { repo } = deps
  return repo.removeBookmark(userId, targetType, targetId)
}
