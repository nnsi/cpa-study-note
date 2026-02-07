import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { users } from "./users"
import { topics } from "./topics"

export type StudyPlanScope = "all" | "subject" | "topic_group"

export const studyPlans = sqliteTable(
  "study_plans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    intent: text("intent"),
    scope: text("scope").$type<StudyPlanScope>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
  },
  (table) => [
    index("study_plans_user_id_idx").on(table.userId),
    index("study_plans_user_archived_idx").on(table.userId, table.archivedAt),
  ]
)

export const studyPlanItems = sqliteTable(
  "study_plan_items",
  {
    id: text("id").primaryKey(),
    studyPlanId: text("study_plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    topicId: text("topic_id").references(() => topics.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    rationale: text("rationale"),
    orderIndex: integer("order_index").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("study_plan_items_plan_id_idx").on(table.studyPlanId),
    index("study_plan_items_topic_id_idx").on(table.topicId),
  ]
)

export const studyPlanRevisions = sqliteTable(
  "study_plan_revisions",
  {
    id: text("id").primaryKey(),
    studyPlanId: text("study_plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    reason: text("reason").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("study_plan_revisions_plan_id_idx").on(table.studyPlanId),
  ]
)
