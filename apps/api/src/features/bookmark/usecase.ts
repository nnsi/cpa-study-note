import type { BookmarkTargetType } from "@cpa-study/db/schema"
import type { BookmarkRepository } from "./repository"
import type { BookmarkWithDetails } from "@cpa-study/shared/schemas"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, type AppError } from "@/shared/lib/errors"

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

  // ブックマークの詳細情報を取得（ユーザー境界と削除フラグを考慮）
  const bookmarksWithDetails: BookmarkWithDetails[] = []

  for (const bookmark of bookmarks) {
    const details = await repo.getBookmarkDetails(bookmark.targetType, bookmark.targetId, userId)

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
): Promise<Result<{ alreadyExists: boolean }, AppError>> => {
  const { repo } = deps

  // 対象が存在するか確認（ユーザー境界と削除フラグを考慮）
  const exists = await repo.targetExists(targetType, targetId, userId)
  if (!exists) {
    return err(notFound("ブックマーク対象が見つかりません"))
  }

  // ブックマーク追加（冪等、重複は無視）
  const result = await repo.addBookmark(userId, targetType, targetId)

  return ok({ alreadyExists: result.alreadyExists })
}

// ブックマーク削除
export const removeBookmark = async (
  deps: BookmarkDeps,
  userId: string,
  targetType: BookmarkTargetType,
  targetId: string
): Promise<Result<void, AppError>> => {
  const { repo } = deps
  const removed = await repo.removeBookmark(userId, targetType, targetId)

  if (!removed) {
    return err(notFound("ブックマークが見つかりません"))
  }

  return ok(undefined)
}
