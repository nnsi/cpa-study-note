import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { users } from "./users"
import { images } from "./images"
import { topics } from "./topics"

export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    imageId: text("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    topicId: text("topic_id").references(() => topics.id, { onDelete: "set null" }),
    suggestedTopicIds: text("suggested_topic_ids"), // JSON array
    markedAsUnderstood: integer("marked_as_understood", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
  },
  (table) => [
    index("exercises_user_id_idx").on(table.userId),
    index("exercises_topic_id_idx").on(table.topicId),
    index("exercises_image_id_idx").on(table.imageId),
  ]
)
