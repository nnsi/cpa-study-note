import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const studyDomains = sqliteTable("study_domains", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  emoji: text("emoji"),
  color: text("color"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})
