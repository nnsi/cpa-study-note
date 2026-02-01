import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core"
import { users } from "./users"
import { studyDomains } from "./studyDomain"

export const userStudyDomains = sqliteTable(
  "user_study_domains",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studyDomainId: text("study_domain_id")
      .notNull()
      .references(() => studyDomains.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    unique().on(table.userId, table.studyDomainId),
    index("user_study_domains_user_id_idx").on(table.userId),
    index("user_study_domains_study_domain_id_idx").on(table.studyDomainId),
  ]
)
