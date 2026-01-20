import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { users } from "./users"

export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  r2Key: text("r2_key").notNull(),
  ocrText: text("ocr_text"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})
