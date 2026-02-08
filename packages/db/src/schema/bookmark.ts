import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core"
import { users } from "./users"

/**
 * ブックマーク対象の種類
 * - subject: 科目
 * - category: 単元（カテゴリ）
 * - topic: 論点
 */
export type BookmarkTargetType = "subject" | "category" | "topic"

/**
 * ユーザーブックマーク
 * 科目・単元・論点を横断的にブックマークできるように targetType + targetId で管理
 */
export const userBookmarks = sqliteTable(
  "user_bookmarks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").$type<BookmarkTargetType>().notNull(),
    targetId: text("target_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    // 同じユーザーが同じ対象を重複してブックマークできないように
    unique().on(table.userId, table.targetType, table.targetId),
    // ユーザーのブックマーク一覧取得用
    index("user_bookmarks_user_id_idx").on(table.userId),
    // 対象タイプごとのフィルタリング用
    index("user_bookmarks_user_type_idx").on(table.userId, table.targetType),
  ]
)
