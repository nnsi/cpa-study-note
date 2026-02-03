/**
 * E2E: マルチユーザー境界テスト
 *
 * テスト対象:
 * - 他ユーザーのデータにアクセスできないこと
 * - 科目、トピック、進捗、チェック履歴、フィルタ、検索の境界検証
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { eq } from "drizzle-orm"
import * as schema from "@cpa-study/db/schema"
import {
  setupTestEnv,
  cleanupTestEnv,
  type TestContext,
} from "./helpers"

describe("E2E: Multi-user boundary tests", () => {
  let ctx: TestContext

  // UserA: テストデータを持つユーザー（seedTestDataで作成される）
  const userAId = "test-user-1"
  // UserB: 別のユーザー（userAのデータにアクセスしようとする）
  const userBId = "user-b-boundary-test"

  // UserAのデータ
  let userAStudyDomainId: string
  let userASubjectId: string
  let userACategoryId: string
  let userATopicId: string
  let userATopic2Id: string

  // UserBのデータ
  let userBStudyDomainId: string
  let userBSubjectId: string
  let userBCategoryId: string
  let userBTopicId: string

  // リクエストヘルパー
  const makeRequest = (
    path: string,
    options: {
      method?: string
      userId: string
      body?: unknown
    }
  ) => {
    const { method = "GET", userId, body } = options
    return ctx.app.request(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Dev-User-Id": userId,
      },
      body: body ? JSON.stringify(body) : undefined,
    }, ctx.env)
  }

  beforeAll(() => {
    ctx = setupTestEnv()

    const now = new Date()

    // seedTestDataで作成されたデータを参照
    userAStudyDomainId = ctx.testData.studyDomainId
    userASubjectId = ctx.testData.subjectId
    userACategoryId = ctx.testData.categoryId
    userATopicId = ctx.testData.topicId

    // UserA用の追加トピック（フィルタ・検索テスト用）
    userATopic2Id = "topic-user-a-2"
    ctx.db.insert(schema.topics).values({
      id: userATopic2Id,
      userId: userAId,
      categoryId: userACategoryId,
      name: "UserAのトピック2",
      description: "UserA専用のトピック",
      displayOrder: 2,
      createdAt: now,
      updatedAt: now,
    }).run()

    // UserAの進捗データ
    ctx.db.insert(schema.userTopicProgress).values({
      id: "progress-user-a-1",
      userId: userAId,
      topicId: userATopicId,
      understood: true,
      lastAccessedAt: now,
      questionCount: 5,
      goodQuestionCount: 2,
      createdAt: now,
      updatedAt: now,
    }).run()

    // UserAのチェック履歴
    ctx.db.insert(schema.topicCheckHistory).values({
      id: "check-history-user-a-1",
      userId: userAId,
      topicId: userATopicId,
      action: "checked",
      checkedAt: now,
    }).run()

    // UserBを作成
    ctx.db.insert(schema.users).values({
      id: userBId,
      email: "userb@example.com",
      name: "User B",
      createdAt: now,
      updatedAt: now,
    }).run()

    // UserBの学習領域を作成
    userBStudyDomainId = "domain-user-b"
    ctx.db.insert(schema.studyDomains).values({
      id: userBStudyDomainId,
      userId: userBId,
      name: "UserBの学習領域",
      description: "UserB専用",
      createdAt: now,
      updatedAt: now,
    }).run()

    // UserBの科目を作成
    userBSubjectId = "subject-user-b"
    ctx.db.insert(schema.subjects).values({
      id: userBSubjectId,
      userId: userBId,
      studyDomainId: userBStudyDomainId,
      name: "UserBの科目",
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    }).run()

    // UserBのカテゴリを作成
    userBCategoryId = "category-user-b"
    ctx.db.insert(schema.categories).values({
      id: userBCategoryId,
      userId: userBId,
      subjectId: userBSubjectId,
      name: "UserBのカテゴリ",
      depth: 1,
      parentId: null,
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    }).run()

    // UserBのトピックを作成
    userBTopicId = "topic-user-b"
    ctx.db.insert(schema.topics).values({
      id: userBTopicId,
      userId: userBId,
      categoryId: userBCategoryId,
      name: "UserBのトピック",
      description: "UserB専用のトピック",
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    }).run()

    // UserBの進捗データ
    ctx.db.insert(schema.userTopicProgress).values({
      id: "progress-user-b-1",
      userId: userBId,
      topicId: userBTopicId,
      understood: true,
      lastAccessedAt: now,
      questionCount: 3,
      goodQuestionCount: 1,
      createdAt: now,
      updatedAt: now,
    }).run()

    // UserBのチェック履歴
    ctx.db.insert(schema.topicCheckHistory).values({
      id: "check-history-user-b-1",
      userId: userBId,
      topicId: userBTopicId,
      action: "checked",
      checkedAt: now,
    }).run()
  })

  afterAll(() => {
    cleanupTestEnv(ctx)
  })

  describe("Subject boundary", () => {
    it("should not return other user's subjects in list", async () => {
      // UserBとしてUserB自身の学習領域の科目一覧を取得
      const res = await makeRequest(`/api/subjects?studyDomainId=${userBStudyDomainId}`, {
        userId: userBId,
      })

      expect(res.status).toBe(200)
      const data = await res.json() as { subjects: Array<{ id: string; name: string }> }
      expect(data.subjects).toBeDefined()

      // UserAの科目が含まれていないことを確認
      const hasUserASubject = data.subjects.some((s) => s.id === userASubjectId)
      expect(hasUserASubject).toBe(false)
    })

    it("should return 404 when accessing other user's subject", async () => {
      // UserBがUserAの科目にアクセスしようとする
      const res = await makeRequest(`/api/subjects/${userASubjectId}`, {
        userId: userBId,
      })

      expect(res.status).toBe(404)
    })

    it("should return 404 when accessing other user's study domain subjects", async () => {
      // UserBがUserAの学習領域の科目一覧を取得しようとする
      const res = await makeRequest(`/api/subjects/study-domains/${userAStudyDomainId}/subjects`, {
        userId: userBId,
      })

      expect(res.status).toBe(404)
    })
  })

  describe("Topic boundary", () => {
    it("should return 404 when accessing other user's topic", async () => {
      // UserBがUserAのトピックにアクセスしようとする
      const res = await makeRequest(`/api/subjects/${userASubjectId}/topics/${userATopicId}`, {
        userId: userBId,
      })

      expect(res.status).toBe(404)
    })

    it("should return 404 when listing other user's category topics", async () => {
      // UserBがUserAのカテゴリのトピック一覧を取得しようとする
      // 階層検証により、categoryIdがsubjectIdに属していないため404が返る
      const res = await makeRequest(`/api/subjects/${userASubjectId}/categories/${userACategoryId}/topics`, {
        userId: userBId,
      })

      expect(res.status).toBe(404)
    })
  })

  describe("Progress boundary", () => {
    it("should not return other user's progress in user progress list", async () => {
      // UserBの進捗一覧を取得
      const res = await makeRequest("/api/learning/progress", {
        userId: userBId,
      })

      expect(res.status).toBe(200)
      const data = await res.json() as { progress: Array<{ topicId: string }> }
      expect(data.progress).toBeDefined()

      // UserAのトピックの進捗が含まれていないことを確認
      const hasUserAProgress = data.progress.some((p) => p.topicId === userATopicId)
      expect(hasUserAProgress).toBe(false)

      // UserBのトピックの進捗のみ含まれることを確認
      const hasUserBProgress = data.progress.some((p) => p.topicId === userBTopicId)
      expect(hasUserBProgress).toBe(true)
    })

    it("should not allow updating other user's topic progress (returns 404)", async () => {
      // UserBがUserAのトピックの進捗を更新しようとする
      // トピック所有権チェックにより404が返される
      const res = await makeRequest(
        `/api/learning/topics/${userATopicId}/progress`,
        {
          method: "PUT",
          userId: userBId,
          body: { understood: false },
        }
      )

      // 他ユーザーのトピックなので404が返される
      expect(res.status).toBe(404)

      // UserAの進捗が変更されていないことを確認
      const userAProgressRes = await makeRequest("/api/learning/progress", {
        userId: userAId,
      })
      const userAData = await userAProgressRes.json() as { progress: Array<{ topicId: string; understood: boolean }> }
      const userAProgress = userAData.progress.find((p) => p.topicId === userATopicId)
      expect(userAProgress?.understood).toBe(true) // 変更されていない
    })

    it("should not return other user's subject progress stats", async () => {
      // UserBの科目別進捗統計を取得
      const res = await makeRequest("/api/learning/subjects/progress-stats", {
        userId: userBId,
      })

      expect(res.status).toBe(200)
      const data = await res.json() as { stats: Array<{ subjectId: string }> }
      expect(data.stats).toBeDefined()

      // UserAの科目が含まれていないことを確認
      const hasUserASubject = data.stats.some((s) => s.subjectId === userASubjectId)
      expect(hasUserASubject).toBe(false)
    })
  })

  describe("Check history boundary", () => {
    it("should return 404 when accessing other user's topic check history", async () => {
      // UserBがUserAのトピックのチェック履歴を取得しようとする
      // トピック所有権チェックにより404が返る
      const res = await makeRequest(
        `/api/learning/topics/${userATopicId}/check-history`,
        { userId: userBId }
      )

      expect(res.status).toBe(404)
    })

    it("should return own check history", async () => {
      // UserAが自分のチェック履歴を取得
      const res = await makeRequest(
        `/api/learning/topics/${userATopicId}/check-history`,
        { userId: userAId }
      )

      expect(res.status).toBe(200)
      const data = await res.json() as { history: Array<{ id: string; action: string }> }
      expect(data.history.length).toBeGreaterThan(0)
    })
  })

  describe("Recent topics boundary", () => {
    it("should not return other user's topics in recent list", async () => {
      // UserBの最近アクセスしたトピック一覧を取得
      const res = await makeRequest("/api/learning/topics/recent", {
        userId: userBId,
      })

      expect(res.status).toBe(200)
      const data = await res.json() as { topics: Array<{ topicId: string }> }
      expect(data.topics).toBeDefined()

      // UserAのトピックが含まれていないことを確認
      const hasUserATopic = data.topics.some((t) => t.topicId === userATopicId)
      expect(hasUserATopic).toBe(false)
    })
  })

  describe("Subject tree boundary", () => {
    it("should return 404 when accessing other user's subject tree", async () => {
      // UserBがUserAの科目ツリーにアクセスしようとする
      const res = await makeRequest(`/api/subjects/${userASubjectId}/tree`, {
        userId: userBId,
      })

      expect(res.status).toBe(404)
    })

    it("should return 404 when updating other user's subject tree", async () => {
      // UserBがUserAの科目ツリーを更新しようとする
      const res = await makeRequest(`/api/subjects/${userASubjectId}/tree`, {
        method: "PUT",
        userId: userBId,
        body: { categories: [] },
      })

      expect(res.status).toBe(404)
    })
  })

  describe("Cross-user data modification attempts", () => {
    it("should return 404 when trying to create subject in other user's domain", async () => {
      // UserBがUserAの学習領域に科目を作成しようとする
      const res = await makeRequest(`/api/subjects/study-domains/${userAStudyDomainId}/subjects`, {
        method: "POST",
        userId: userBId,
        body: { name: "不正な科目" },
      })

      expect(res.status).toBe(404)
    })

    it("should return 404 when trying to update other user's subject", async () => {
      // UserBがUserAの科目を更新しようとする
      const res = await makeRequest(`/api/subjects/${userASubjectId}`, {
        method: "PATCH",
        userId: userBId,
        body: { name: "ハイジャックされた科目" },
      })

      expect(res.status).toBe(404)
    })

    it("should return 404 when trying to delete other user's subject", async () => {
      // UserBがUserAの科目を削除しようとする
      const res = await makeRequest(`/api/subjects/${userASubjectId}`, {
        method: "DELETE",
        userId: userBId,
      })

      expect(res.status).toBe(404)
    })

    it("should return 404 when trying to import CSV to other user's subject", async () => {
      // UserBがUserAの科目にCSVインポートしようとする
      const res = await makeRequest(`/api/subjects/${userASubjectId}/import`, {
        method: "POST",
        userId: userBId,
        body: { csvContent: "カテゴリ,サブカテゴリ,論点\n不正,不正,不正" },
      })

      expect(res.status).toBe(404)
    })
  })

  describe("Bookmark boundary", () => {
    // UserAのブックマークID（テスト中に設定）
    let userABookmarkSubjectId: string

    it("should not allow bookmarking other user's subject", async () => {
      // UserBがUserAの科目をブックマークしようとする
      const res = await makeRequest("/api/bookmarks", {
        method: "POST",
        userId: userBId,
        body: { targetType: "subject", targetId: userASubjectId },
      })

      // 他ユーザーの科目なので404が返される
      expect(res.status).toBe(404)
    })

    it("should not allow bookmarking other user's category", async () => {
      // UserBがUserAのカテゴリをブックマークしようとする
      const res = await makeRequest("/api/bookmarks", {
        method: "POST",
        userId: userBId,
        body: { targetType: "category", targetId: userACategoryId },
      })

      // 他ユーザーのカテゴリなので404が返される
      expect(res.status).toBe(404)
    })

    it("should not allow bookmarking other user's topic", async () => {
      // UserBがUserAのトピックをブックマークしようとする
      const res = await makeRequest("/api/bookmarks", {
        method: "POST",
        userId: userBId,
        body: { targetType: "topic", targetId: userATopicId },
      })

      // 他ユーザーのトピックなので404が返される
      expect(res.status).toBe(404)
    })

    it("should allow bookmarking own subject", async () => {
      // UserAが自分の科目をブックマーク
      const res = await makeRequest("/api/bookmarks", {
        method: "POST",
        userId: userAId,
        body: { targetType: "subject", targetId: userASubjectId },
      })

      expect(res.status).toBe(201)
      const data = await res.json() as { message: string }
      expect(data.message).toBe("Bookmark added")
    })

    it("should not return other user's bookmarks in list", async () => {
      // まずUserBが自分の科目をブックマーク
      await makeRequest("/api/bookmarks", {
        method: "POST",
        userId: userBId,
        body: { targetType: "subject", targetId: userBSubjectId },
      })

      // UserBのブックマーク一覧を取得
      const res = await makeRequest("/api/bookmarks", {
        userId: userBId,
      })

      expect(res.status).toBe(200)
      const data = await res.json() as { bookmarks: Array<{ targetId: string; targetType: string }> }
      expect(data.bookmarks).toBeDefined()

      // UserAの科目がUserBのブックマーク一覧に含まれていないことを確認
      const hasUserASubject = data.bookmarks.some((b) => b.targetId === userASubjectId)
      expect(hasUserASubject).toBe(false)

      // UserBの科目は含まれていることを確認
      const hasUserBSubject = data.bookmarks.some((b) => b.targetId === userBSubjectId)
      expect(hasUserBSubject).toBe(true)
    })

    it("should not return other user's bookmarks in own list", async () => {
      // UserAのブックマーク一覧を取得
      const res = await makeRequest("/api/bookmarks", {
        userId: userAId,
      })

      expect(res.status).toBe(200)
      const data = await res.json() as { bookmarks: Array<{ targetId: string; targetType: string }> }
      expect(data.bookmarks).toBeDefined()

      // UserBの科目がUserAのブックマーク一覧に含まれていないことを確認
      const hasUserBSubject = data.bookmarks.some((b) => b.targetId === userBSubjectId)
      expect(hasUserBSubject).toBe(false)

      // UserAの科目は含まれていることを確認
      const hasUserASubject = data.bookmarks.some((b) => b.targetId === userASubjectId)
      expect(hasUserASubject).toBe(true)
    })
  })

  describe("Bookmark soft-deleted resource boundary", () => {
    // 論理削除テスト用のデータ
    const deletedSubjectForBookmarkId = "subject-deleted-for-bookmark"

    beforeAll(() => {
      const now = new Date()
      const deletedAt = new Date(Date.now() - 3600000) // 1時間前に削除

      // 論理削除された科目を作成
      ctx.db.insert(schema.subjects).values({
        id: deletedSubjectForBookmarkId,
        userId: userAId,
        studyDomainId: userAStudyDomainId,
        name: "ブックマーク用削除科目",
        displayOrder: 98,
        createdAt: now,
        updatedAt: now,
        deletedAt: deletedAt,
      }).run()
    })

    it("should not allow bookmarking soft-deleted subject", async () => {
      // UserAが論理削除された科目をブックマークしようとする
      const res = await makeRequest("/api/bookmarks", {
        method: "POST",
        userId: userAId,
        body: { targetType: "subject", targetId: deletedSubjectForBookmarkId },
      })

      // 論理削除された科目なので404が返される
      expect(res.status).toBe(404)
    })

    it("should not include soft-deleted subject bookmark in list", async () => {
      // 先にブックマークを作成してから科目を削除するケースをテスト
      const testSubjectId = "subject-to-delete-after-bookmark"
      const now = new Date()

      // 科目を作成
      ctx.db.insert(schema.subjects).values({
        id: testSubjectId,
        userId: userAId,
        studyDomainId: userAStudyDomainId,
        name: "削除予定の科目",
        displayOrder: 97,
        createdAt: now,
        updatedAt: now,
      }).run()

      // ブックマーク追加
      const addRes = await makeRequest("/api/bookmarks", {
        method: "POST",
        userId: userAId,
        body: { targetType: "subject", targetId: testSubjectId },
      })
      expect(addRes.status).toBe(201)

      // 科目を論理削除
      ctx.db.update(schema.subjects)
        .set({ deletedAt: new Date() })
        .where(eq(schema.subjects.id, testSubjectId))
        .run()

      // ブックマーク一覧を取得
      const listRes = await makeRequest("/api/bookmarks", {
        userId: userAId,
      })

      expect(listRes.status).toBe(200)
      const data = await listRes.json() as { bookmarks: Array<{ targetId: string }> }

      // 論理削除された科目のブックマークが一覧に含まれていないことを確認
      const hasDeletedSubject = data.bookmarks.some((b) => b.targetId === testSubjectId)
      expect(hasDeletedSubject).toBe(false)
    })
  })

  describe("Soft delete (deletedAt) boundary", () => {
    // 論理削除用のテストデータID
    const deletedSubjectId = "subject-deleted"
    const deletedCategoryId = "category-deleted"
    const deletedTopicId = "topic-deleted"

    beforeAll(() => {
      const now = new Date()
      const deletedAt = new Date(Date.now() - 3600000) // 1時間前に削除

      // 論理削除された科目を作成
      ctx.db.insert(schema.subjects).values({
        id: deletedSubjectId,
        userId: userAId,
        studyDomainId: userAStudyDomainId,
        name: "削除された科目",
        displayOrder: 99,
        createdAt: now,
        updatedAt: now,
        deletedAt: deletedAt,
      }).run()

      // 論理削除された科目内のカテゴリ
      ctx.db.insert(schema.categories).values({
        id: deletedCategoryId,
        userId: userAId,
        subjectId: deletedSubjectId,
        name: "削除された科目のカテゴリ",
        depth: 1,
        parentId: null,
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: deletedAt,
      }).run()

      // 論理削除された科目内のトピック
      ctx.db.insert(schema.topics).values({
        id: deletedTopicId,
        userId: userAId,
        categoryId: deletedCategoryId,
        name: "削除されたトピック検索テスト",
        description: "このトピックは論理削除済み",
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: deletedAt,
      }).run()

      // 論理削除されたトピックの進捗データ
      ctx.db.insert(schema.userTopicProgress).values({
        id: "progress-deleted-topic",
        userId: userAId,
        topicId: deletedTopicId,
        understood: true,
        lastAccessedAt: now,
        questionCount: 10,
        goodQuestionCount: 5,
        createdAt: now,
        updatedAt: now,
      }).run()
    })

    it("should not return soft-deleted subjects in list", async () => {
      // UserAの科目一覧を取得
      const res = await makeRequest(`/api/subjects?studyDomainId=${userAStudyDomainId}`, {
        userId: userAId,
      })

      expect(res.status).toBe(200)
      const data = await res.json() as { subjects: Array<{ id: string; name: string }> }

      // 論理削除された科目が含まれていないことを確認
      const hasDeletedSubject = data.subjects.some((s) => s.id === deletedSubjectId)
      expect(hasDeletedSubject).toBe(false)

      // 通常の科目は含まれていることを確認
      const hasNormalSubject = data.subjects.some((s) => s.id === userASubjectId)
      expect(hasNormalSubject).toBe(true)
    })

    it("should return 404 when directly accessing soft-deleted subject", async () => {
      // 論理削除された科目に直接アクセス
      const res = await makeRequest(`/api/subjects/${deletedSubjectId}`, {
        userId: userAId,
      })

      expect(res.status).toBe(404)
    })

    it("should return 404 when accessing soft-deleted subject tree", async () => {
      // 論理削除された科目のツリーにアクセス
      const res = await makeRequest(`/api/subjects/${deletedSubjectId}/tree`, {
        userId: userAId,
      })

      expect(res.status).toBe(404)
    })

    it("should return 404 when accessing soft-deleted subject detail", async () => {
      // 論理削除された科目の詳細にアクセス
      const res = await makeRequest(`/api/subjects/${deletedSubjectId}/detail`, {
        userId: userAId,
      })

      expect(res.status).toBe(404)
    })

    it("should not return soft-deleted topics progress in recent list", async () => {
      // 最近アクセスしたトピック一覧を取得
      const res = await makeRequest("/api/learning/topics/recent", {
        userId: userAId,
      })

      expect(res.status).toBe(200)
      const data = await res.json() as { topics: Array<{ topicId: string }> }

      // 論理削除されたトピックが含まれていないことを確認
      const hasDeletedTopic = data.topics.some((t) => t.topicId === deletedTopicId)
      expect(hasDeletedTopic).toBe(false)
    })

    it("should not include soft-deleted topics in subject progress stats", async () => {
      // 科目別進捗統計を取得
      const res = await makeRequest("/api/learning/subjects/progress-stats", {
        userId: userAId,
      })

      expect(res.status).toBe(200)
      const data = await res.json() as { stats: Array<{ subjectId: string }> }

      // 論理削除された科目が含まれていないことを確認
      const hasDeletedSubject = data.stats.some((s) => s.subjectId === deletedSubjectId)
      expect(hasDeletedSubject).toBe(false)
    })

    it("should return 404 when updating soft-deleted subject", async () => {
      // 論理削除された科目を更新しようとする
      const res = await makeRequest(`/api/subjects/${deletedSubjectId}`, {
        method: "PATCH",
        userId: userAId,
        body: { name: "復活させようとした科目" },
      })

      expect(res.status).toBe(404)
    })

    it("should return 404 when deleting already soft-deleted subject", async () => {
      // 既に論理削除された科目を削除しようとする
      const res = await makeRequest(`/api/subjects/${deletedSubjectId}`, {
        method: "DELETE",
        userId: userAId,
      })

      expect(res.status).toBe(404)
    })
  })
})
