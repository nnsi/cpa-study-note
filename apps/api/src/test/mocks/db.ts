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
  // 実際のDrizzleスキーマに合わせたテーブル定義
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
      default_study_domain_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS study_domains (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      emoji TEXT,
      color TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS study_domains_user_id_idx ON study_domains(user_id);
    CREATE INDEX IF NOT EXISTS study_domains_user_deleted_idx ON study_domains(user_id, deleted_at);

    CREATE TABLE IF NOT EXISTS user_oauth_connections (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(provider, provider_id)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      study_domain_id TEXT NOT NULL REFERENCES study_domains(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      description TEXT,
      emoji TEXT,
      color TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      UNIQUE(study_domain_id, name)
    );
    CREATE INDEX IF NOT EXISTS subjects_study_domain_id_idx ON subjects(study_domain_id);
    CREATE INDEX IF NOT EXISTS subjects_user_id_idx ON subjects(user_id);
    CREATE INDEX IF NOT EXISTS subjects_user_deleted_idx ON subjects(user_id, deleted_at);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      depth INTEGER NOT NULL,
      parent_id TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS categories_subject_id_idx ON categories(subject_id);
    CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id);
    CREATE INDEX IF NOT EXISTS categories_user_deleted_idx ON categories(user_id, deleted_at);

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      difficulty TEXT,
      topic_type TEXT,
      ai_system_prompt TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS topics_category_id_idx ON topics(category_id);
    CREATE INDEX IF NOT EXISTS topics_user_id_idx ON topics(user_id);
    CREATE INDEX IF NOT EXISTS topics_user_deleted_idx ON topics(user_id, deleted_at);

    CREATE TABLE IF NOT EXISTS user_topic_progress (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      understood INTEGER NOT NULL DEFAULT 0,
      last_accessed_at INTEGER,
      question_count INTEGER NOT NULL DEFAULT 0,
      good_question_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      image_id TEXT,
      ocr_result TEXT,
      question_quality TEXT,
      question_quality_reason TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
      ai_summary TEXT,
      user_memo TEXT,
      key_points TEXT DEFAULT '[]',
      stumbled_points TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      r2_key TEXT NOT NULL,
      ocr_text TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topic_check_history (
      id TEXT PRIMARY KEY NOT NULL,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      checked_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      checked_topic_count INTEGER NOT NULL DEFAULT 0,
      session_count INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      good_question_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(date, user_id)
    );

    CREATE TABLE IF NOT EXISTS user_bookmarks (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, target_type, target_id)
    );
    CREATE INDEX IF NOT EXISTS user_bookmarks_user_id_idx ON user_bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS user_bookmarks_user_type_idx ON user_bookmarks(user_id, target_type);

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
      suggested_topic_ids TEXT,
      marked_as_understood INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      confirmed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS exercises_user_id_idx ON exercises(user_id);
    CREATE INDEX IF NOT EXISTS exercises_topic_id_idx ON exercises(topic_id);
    CREATE INDEX IF NOT EXISTS exercises_image_id_idx ON exercises(image_id);
  `)

  const db = drizzle(sqlite, { schema })

  return { db, sqlite }
}

export const seedTestData = (db: TestDatabase) => {
  // テスト用の基本データを挿入
  const userId = "test-user-1"
  const studyDomainId = "cpa"
  const subjectId = "subject-1"
  const categoryId = "category-1"
  const topicId = "topic-1"
  const now = new Date()

  // ユーザーを最初に作成（study_domainsが参照するため）
  db.insert(schema.users)
    .values({
      id: userId,
      email: "test@example.com",
      name: "Test User",
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // 学習領域を作成
  db.insert(schema.studyDomains)
    .values({
      id: studyDomainId,
      userId: userId,
      name: "公認会計士試験",
      description: "公認会計士試験の学習",
      emoji: "📚",
      color: "indigo",
      createdAt: now,
      updatedAt: now,
    })
    .run()

  db.insert(schema.subjects)
    .values({
      id: subjectId,
      userId: userId,
      studyDomainId: studyDomainId,
      name: "財務会計論",
      description: "財務会計論の科目",
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  db.insert(schema.categories)
    .values({
      id: categoryId,
      userId: userId,
      subjectId,
      name: "計算",
      depth: 0,
      parentId: null,
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  db.insert(schema.topics)
    .values({
      id: topicId,
      userId: userId,
      categoryId,
      name: "有価証券",
      description: "有価証券の評価と会計処理",
      difficulty: "intermediate",
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return { userId, studyDomainId, subjectId, categoryId, topicId }
}
