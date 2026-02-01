import { drizzle } from "drizzle-orm/d1"
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core"
import type { ExtractTablesWithRelations } from "drizzle-orm"
import * as schema from "./schema"

export const createDb = (d1: D1Database) => {
  return drizzle(d1, { schema })
}

// D1 specific type (production)
export type D1Db = ReturnType<typeof createDb>

// Abstract database type that works with both D1 (async) and better-sqlite3 (sync)
// Uses union of both result kinds to allow either database driver
export type Db = BaseSQLiteDatabase<
  "async" | "sync",
  unknown,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

export { schema }
export * from "./schema"
