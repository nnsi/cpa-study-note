import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { users } from "./users"
import { topics } from "./topics"

export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  imageId: text("image_id"),
  ocrResult: text("ocr_result"),
  questionQuality: text("question_quality"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})
