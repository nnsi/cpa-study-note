import type { BookmarkTargetType } from "@cpa-study/db/schema"
import type { BookmarkRepository } from "./repository"
import type { BookmarkWithDetails } from "@cpa-study/shared/schemas"
import type { Logger } from "@/shared/lib/logger"
import type { Tracer } from "@/shared/lib/tracer"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, type AppError } from "@/shared/lib/errors"

export type BookmarkDeps = {
  repo: BookmarkRepository
  logger: Logger
  tracer: Tracer
}

// ブックマーク一覧を詳細情報付きで取得
export const getBookmarks = async (
  deps: BookmarkDeps,
  userId: string
): Promise<Result<BookmarkWithDetails[], AppError>> => {
  const { repo, logger, tracer } = deps
  const bookmarks = await tracer.span("d1.findBookmarks", () => repo.findBookmarksByUser(userId))

  // ブックマークの詳細情報を取得（ユーザー境界と削除フラグを考慮）
  const bookmarksWithDetails: BookmarkWithDetails[] = []

  for (const bookmark of bookmarks) {
    const details = await tracer.span("d1.getBookmarkDetails", () => repo.getBookmarkDetails(bookmark.targetType, bookmark.targetId, userId))

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

  return ok(bookmarksWithDetails)
}

// ブックマーク追加
export const addBookmark = async (
  deps: BookmarkDeps,
  userId: string,
  targetType: BookmarkTargetType,
  targetId: string
): Promise<Result<BookmarkWithDetails | null, AppError>> => {
  const { repo, logger, tracer } = deps
  // 対象が存在するか確認（ユーザー境界と削除フラグを考慮）
  const exists = await tracer.span("d1.targetExists", () => repo.targetExists(targetType, targetId, userId))
  if (!exists) {
    return err(notFound("ブックマーク対象が見つかりません"))
  }

  // ブックマーク追加（冪等、重複は無視）
  const result = await tracer.span("d1.addBookmark", () => repo.addBookmark(userId, targetType, targetId))

  // 追加されたブックマークの詳細を取得
  const details = await tracer.span("d1.getBookmarkDetails", () => repo.getBookmarkDetails(targetType, targetId, userId))
  const bookmark: BookmarkWithDetails | null =
    details && result.bookmark
      ? {
          id: result.bookmark.id,
          targetType,
          targetId,
          name: details.name,
          path: details.path,
          domainId: details.domainId,
          subjectId: details.subjectId,
          categoryId: details.categoryId,
          createdAt: result.bookmark.createdAt.toISOString(),
        }
      : null

  return ok(bookmark)
}

// ブックマーク削除
export const removeBookmark = async (
  deps: BookmarkDeps,
  userId: string,
  targetType: BookmarkTargetType,
  targetId: string
): Promise<Result<void, AppError>> => {
  const { repo, logger, tracer } = deps
  const removed = await tracer.span("d1.removeBookmark", () => repo.removeBookmark(userId, targetType, targetId))

  if (!removed) {
    return err(notFound("ブックマークが見つかりません"))
  }

  return ok(undefined)
}
