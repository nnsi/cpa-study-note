import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { users } from "./users"

export const studyDomains = sqliteTable(
  "study_domains",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    emoji: text("emoji"),
    color: text("color"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    index("study_domains_user_id_idx").on(table.userId),
    index("study_domains_user_deleted_idx").on(table.userId, table.deletedAt),
  ]
)
