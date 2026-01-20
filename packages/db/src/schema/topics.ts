import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { users } from "./users"

export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  depth: integer("depth").notNull(),
  parentId: text("parent_id"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  difficulty: text("difficulty"),
  topicType: text("topic_type"),
  aiSystemPrompt: text("ai_system_prompt"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const userTopicProgress = sqliteTable("user_topic_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  understood: integer("understood", { mode: "boolean" }).notNull().default(false),
  lastAccessedAt: integer("last_accessed_at", { mode: "timestamp" }),
  questionCount: integer("question_count").notNull().default(0),
  goodQuestionCount: integer("good_question_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})
