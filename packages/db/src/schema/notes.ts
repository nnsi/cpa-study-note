import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { users } from "./users"
import { topics } from "./topics"
import { chatSessions } from "./chat"

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => chatSessions.id, {
    onDelete: "set null",
  }),
  aiSummary: text("ai_summary"),
  userMemo: text("user_memo"),
  keyPoints: text("key_points", { mode: "json" }).$type<string[]>().default([]),
  stumbledPoints: text("stumbled_points", { mode: "json" })
    .$type<string[]>()
    .default([]),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
})
