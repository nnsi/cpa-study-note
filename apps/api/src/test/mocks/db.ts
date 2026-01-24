/**
 * D1Database のインメモリモック（better-sqlite3を使用）
 * テスト用に実際のSQLite動作を提供
 */
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "@cpa-study/db/schema"

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>

export const createTestDatabase = (): {
  db: TestDatabase
  sqlite: Database.Database
} => {
  const sqlite = new Database(":memory:")

  // スキーマを適用（マイグレーション相当）
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_oauth_connections (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE(provider, provider_user_id)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      display_order INTEGER DEFAULT 0 NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
      display_order INTEGER DEFAULT 0 NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      importance TEXT DEFAULT 'normal' NOT NULL,
      display_order INTEGER DEFAULT 0 NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topic_progress (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      understood INTEGER DEFAULT 0 NOT NULL,
      struggling INTEGER DEFAULT 0 NOT NULL,
      last_accessed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE(user_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      question_quality TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
      ai_summary TEXT,
      user_memo TEXT,
      key_points TEXT,
      stumbling_points TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER DEFAULT 0 NOT NULL,
      r2_key TEXT NOT NULL,
      ocr_text TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `)

  const db = drizzle(sqlite, { schema })

  return { db, sqlite }
}

export const seedTestData = (db: TestDatabase) => {
  // テスト用の基本データを挿入
  const userId = "test-user-1"
  const subjectId = "subject-1"
  const categoryId = "category-1"
  const topicId = "topic-1"

  db.insert(schema.users).values({
    id: userId,
    email: "test@example.com",
    displayName: "Test User",
  }).run()

  db.insert(schema.subjects).values({
    id: subjectId,
    name: "財務会計論",
    displayOrder: 1,
  }).run()

  db.insert(schema.categories).values({
    id: categoryId,
    subjectId,
    name: "計算",
    parentId: null,
    displayOrder: 1,
  }).run()

  db.insert(schema.topics).values({
    id: topicId,
    categoryId,
    name: "有価証券",
    description: "有価証券の評価と会計処理",
    importance: "high",
    displayOrder: 1,
  }).run()

  return { userId, subjectId, categoryId, topicId }
}
