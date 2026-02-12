/// <reference types="@cloudflare/workers-types" />
/**
 * テスト用ヘルパー関数
 */
import { z } from "zod"
import type { Env } from "@/shared/types/env"
import type { Logger } from "@/shared/lib/logger"
import { createTestDatabase, TestDatabase, seedTestData } from "./mocks/db"
import { createMockR2Bucket } from "./mocks/r2"
import * as schema from "@cpa-study/db/schema"

/** テスト用の何もしないLogger */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
}

// レスポンスをZodスキーマで検証してパースするヘルパー
export const parseJson = async <T>(res: Response, zodSchema: z.ZodType<T>): Promise<T> => {
  const json: unknown = await res.json()
  return zodSchema.parse(json)
}

// よく使うレスポンススキーマ
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})
export type ErrorResponse = z.infer<typeof errorResponseSchema>

export const successResponseSchema = z.object({
  success: z.boolean(),
})
export type SuccessResponse = z.infer<typeof successResponseSchema>

// テスト用の環境変数
export const createTestEnv = (): Env => ({
  ENVIRONMENT: "local",
  AI_PROVIDER: "mock",
  JWT_SECRET: "test-jwt-secret",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  API_BASE_URL: "http://localhost:8787",
  WEB_BASE_URL: "http://localhost:5173",
  DEV_USER_ID: "test-user-1",
  DB: {} as D1Database,
  R2: createMockR2Bucket(),
  RATE_LIMITER: {} as DurableObjectNamespace,
})

// テスト用のセットアップヘルパー
export type TestContext = {
  db: TestDatabase
  env: Env
  r2: R2Bucket
  testData: ReturnType<typeof seedTestData>
}

export const setupTestContext = (): TestContext => {
  const { db } = createTestDatabase()
  const testData = seedTestData(db)
  const r2 = createMockR2Bucket()
  const env = {
    ...createTestEnv(),
    R2: r2,
  }

  return { db, env, r2, testData }
}

// 認証ヘッダー生成（ローカル環境用）
export const createAuthHeaders = (userId: string = "test-user-1") => ({
  "X-Dev-User-Id": userId,
  "Content-Type": "application/json",
})

// 追加のテストデータ作成関数
export const createAdditionalTestData = (db: TestDatabase, baseData: ReturnType<typeof seedTestData>) => {
  const now = new Date()

  // 別のユーザー
  const otherUserId = "other-user-1"
  db.insert(schema.users)
    .values({
      id: otherUserId,
      email: "other@example.com",
      name: "Other User",
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // 追加の科目 (v2.1: userIdが必須)
  const subject2Id = "subject-2"
  db.insert(schema.subjects)
    .values({
      id: subject2Id,
      userId: baseData.userId,
      studyDomainId: baseData.studyDomainId,
      name: "管理会計論",
      description: "管理会計論の科目",
      displayOrder: 2,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // 追加のカテゴリ（階層構造テスト用、v2.1: userIdが必須）
  const childCategoryId = "category-child-1"
  db.insert(schema.categories)
    .values({
      id: childCategoryId,
      userId: baseData.userId,
      subjectId: baseData.subjectId,
      name: "子カテゴリ",
      depth: 1,
      parentId: baseData.categoryId,
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // 追加の論点 (v2.1: userIdが必須)
  const topic2Id = "topic-2"
  db.insert(schema.topics)
    .values({
      id: topic2Id,
      userId: baseData.userId,
      categoryId: baseData.categoryId,
      name: "棚卸資産",
      description: "棚卸資産の評価方法",
      difficulty: "basic",
      displayOrder: 2,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // チャットセッション
  const sessionId = "session-1"
  db.insert(schema.chatSessions)
    .values({
      id: sessionId,
      userId: baseData.userId,
      topicId: baseData.topicId,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // チャットメッセージ
  db.insert(schema.chatMessages)
    .values({
      id: "message-1",
      sessionId,
      role: "user",
      content: "有価証券の評価方法について教えてください",
      createdAt: now,
    })
    .run()

  db.insert(schema.chatMessages)
    .values({
      id: "message-2",
      sessionId,
      role: "assistant",
      content: "有価証券の評価方法には売買目的、満期保有目的などがあります。",
      createdAt: now,
    })
    .run()

  // 他ユーザーのセッション
  const otherSessionId = "session-other-1"
  db.insert(schema.chatSessions)
    .values({
      id: otherSessionId,
      userId: otherUserId,
      topicId: baseData.topicId,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return {
    otherUserId,
    subject2Id,
    childCategoryId,
    topic2Id,
    sessionId,
    otherSessionId,
  }
}

// ノートテストデータ作成
export const createNoteTestData = (db: TestDatabase, userId: string, topicId: string, sessionId: string | null = null) => {
  const noteId = `note-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date()

  db.insert(schema.notes)
    .values({
      id: noteId,
      userId,
      topicId,
      sessionId,
      aiSummary: "テスト要約",
      userMemo: "テストメモ",
      keyPoints: ["ポイント1", "ポイント2"],
      stumbledPoints: ["つまずき1"],
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return { noteId }
}

// 画像テストデータ作成
export const createImageTestData = (db: TestDatabase, userId: string) => {
  const imageId = `image-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date()

  db.insert(schema.images)
    .values({
      id: imageId,
      userId,
      filename: "test.png",
      mimeType: "image/png",
      size: 1024,
      r2Key: `images/${imageId}/test.png`,
      ocrText: null,
      createdAt: now,
    })
    .run()

  return { imageId }
}

// 進捗テストデータ作成
export const createProgressTestData = (db: TestDatabase, userId: string, topicId: string, understood: boolean = false) => {
  const progressId = `progress-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date()

  db.insert(schema.userTopicProgress)
    .values({
      id: progressId,
      userId,
      topicId,
      understood,
      lastAccessedAt: now,
      questionCount: 5,
      goodQuestionCount: 2,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return { progressId }
}

// v2.1用のテストデータ作成ヘルパー
export const createTestStudyDomain = (
  db: TestDatabase,
  userId: string,
  data: { name?: string; description?: string; emoji?: string; color?: string; deletedAt?: Date } = {}
) => {
  const id = `domain-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date()

  db.insert(schema.studyDomains)
    .values({
      id,
      userId,
      name: data.name ?? "Test Domain",
      description: data.description ?? null,
      emoji: data.emoji ?? null,
      color: data.color ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: data.deletedAt ?? null,
    })
    .run()

  return { id }
}

export const createTestSubject = (
  db: TestDatabase,
  userId: string,
  studyDomainId: string,
  data: { name?: string; description?: string; emoji?: string; color?: string; deletedAt?: Date } = {}
) => {
  const id = `subject-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date()

  db.insert(schema.subjects)
    .values({
      id,
      userId,
      studyDomainId,
      name: data.name ?? "Test Subject",
      description: data.description ?? null,
      emoji: data.emoji ?? null,
      color: data.color ?? null,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: data.deletedAt ?? null,
    })
    .run()

  return { id }
}

export const createTestCategory = (
  db: TestDatabase,
  userId: string,
  subjectId: string,
  data: { name?: string; depth?: number; parentId?: string | null; deletedAt?: Date } = {}
) => {
  const id = `category-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date()

  db.insert(schema.categories)
    .values({
      id,
      userId,
      subjectId,
      name: data.name ?? "Test Category",
      depth: data.depth ?? 1,
      parentId: data.parentId ?? null,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: data.deletedAt ?? null,
    })
    .run()

  return { id }
}

export const createTestTopic = (
  db: TestDatabase,
  userId: string,
  categoryId: string,
  data: { name?: string; description?: string; difficulty?: string; deletedAt?: Date } = {}
) => {
  const id = `topic-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date()

  db.insert(schema.topics)
    .values({
      id,
      userId,
      categoryId,
      name: data.name ?? "Test Topic",
      description: data.description ?? null,
      difficulty: data.difficulty ?? null,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: data.deletedAt ?? null,
    })
    .run()

  return { id }
}

export const createTestUser = (
  db: TestDatabase,
  data: { email?: string; name?: string } = {}
) => {
  const id = `user-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date()

  db.insert(schema.users)
    .values({
      id,
      email: data.email ?? `${id}@example.com`,
      name: data.name ?? "Test User",
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return { id }
}
