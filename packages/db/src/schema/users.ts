import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core"
import { studyDomains } from "./studyDomain"

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  defaultStudyDomainId: text("default_study_domain_id").references(
    () => studyDomains.id,
    { onDelete: "set null" }
  ),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const userOAuthConnections = sqliteTable(
  "user_oauth_connections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerId: text("provider_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [unique().on(table.provider, table.providerId)]
)
