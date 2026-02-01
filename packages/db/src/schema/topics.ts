import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core"
import { users } from "./users"
import { studyDomains } from "./studyDomain"

export const subjects = sqliteTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    studyDomainId: text("study_domain_id")
      .notNull()
      .references(() => studyDomains.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    emoji: text("emoji"),
    color: text("color"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    unique().on(table.studyDomainId, table.name),
    index("subjects_study_domain_id_idx").on(table.studyDomainId),
    index("subjects_user_id_idx").on(table.userId),
    index("subjects_user_deleted_idx").on(table.userId, table.deletedAt),
  ]
)

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    depth: integer("depth").notNull(),
    parentId: text("parent_id"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    index("categories_subject_id_idx").on(table.subjectId),
    index("categories_user_id_idx").on(table.userId),
    index("categories_user_deleted_idx").on(table.userId, table.deletedAt),
  ]
)

export const topics = sqliteTable(
  "topics",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
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
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    index("topics_category_id_idx").on(table.categoryId),
    index("topics_user_id_idx").on(table.userId),
    index("topics_user_deleted_idx").on(table.userId, table.deletedAt),
  ]
)

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
