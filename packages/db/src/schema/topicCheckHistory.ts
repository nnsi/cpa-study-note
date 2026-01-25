import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { topics } from "./topics"
import { users } from "./users"

export const topicCheckHistory = sqliteTable("topic_check_history", {
  id: text("id").primaryKey(),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: text("action", { enum: ["checked", "unchecked"] }).notNull(),
  checkedAt: integer("checked_at", { mode: "timestamp" }).notNull(),
})
