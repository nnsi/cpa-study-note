import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core"
import { users } from "./users"

export const metricSnapshots = sqliteTable(
  "metric_snapshots",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(), // YYYY-MM-DD形式
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkedTopicCount: integer("checked_topic_count").notNull().default(0),
    sessionCount: integer("session_count").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),
    goodQuestionCount: integer("good_question_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [unique().on(table.date, table.userId)]
)
