/**
 * StudyPlan UseCase のテスト
 */
import { describe, it, expect, vi } from "vitest"
import type { StudyPlanRepository, StudyPlan, StudyPlanItem, StudyPlanRevision, StudyPlanWithItemCount } from "./repository"
import { noopLogger } from "../../test/helpers"
import {
  listPlans,
  getPlanDetail,
  createPlan,
  updatePlan,
  archivePlan,
  unarchivePlan,
  duplicatePlan,
  addItem,
  updateItem,
  removeItem,
  reorderItems,
  addRevision,
  updateRevision,
} from "./usecase"

// テストデータ生成ヘルパー
const createMockDate = (offset = 0) => new Date(Date.now() + offset)

const createMockPlan = (overrides: Partial<StudyPlan> = {}): StudyPlan => ({
  id: "plan-1",
  userId: "user-1",
  title: "財務会計学習計画",
  intent: "短答式対策",
  scope: "subject",
  subjectId: "subject-1",
  subjectName: "財務会計論",
  createdAt: createMockDate(),
  updatedAt: createMockDate(),
  archivedAt: null,
  ...overrides,
})

const createMockPlanWithCount = (overrides: Partial<StudyPlanWithItemCount> = {}): StudyPlanWithItemCount => ({
  ...createMockPlan(),
  itemCount: 3,
  ...overrides,
})

const createMockItem = (overrides: Partial<StudyPlanItem> = {}): StudyPlanItem => ({
  id: "item-1",
  studyPlanId: "plan-1",
  topicId: "topic-1",
  topicName: "有価証券",
  description: "有価証券の分類と評価",
  rationale: "基礎的な論点",
  orderIndex: 0,
  createdAt: createMockDate(),
  ...overrides,
})

const createMockRevision = (overrides: Partial<StudyPlanRevision> = {}): StudyPlanRevision => ({
  id: "revision-1",
  studyPlanId: "plan-1",
  summary: "初期計画策定",
  reason: null,
  createdAt: createMockDate(),
  ...overrides,
})

// モックリポジトリファクトリ
const createMockRepo = (overrides: Partial<StudyPlanRepository> = {}): StudyPlanRepository => ({
  findPlansByUser: vi.fn().mockResolvedValue([]),
  findPlanById: vi.fn().mockResolvedValue(null),
  createPlan: vi.fn().mockResolvedValue(createMockPlan()),
  updatePlan: vi.fn().mockResolvedValue(null),
  archivePlan: vi.fn().mockResolvedValue(false),
  unarchivePlan: vi.fn().mockResolvedValue(false),
  duplicatePlan: vi.fn().mockResolvedValue(null),
  findItemsByPlan: vi.fn().mockResolvedValue([]),
  createItem: vi.fn().mockResolvedValue(createMockItem()),
  updateItem: vi.fn().mockResolvedValue(null),
  deleteItem: vi.fn().mockResolvedValue(false),
  reorderItems: vi.fn().mockResolvedValue(undefined),
  findItemById: vi.fn().mockResolvedValue(null),
  findRevisionsByPlan: vi.fn().mockResolvedValue([]),
  createRevision: vi.fn().mockResolvedValue(createMockRevision()),
  updateRevision: vi.fn().mockResolvedValue(null),
  isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
  ...overrides,
})

describe("StudyPlan UseCase", () => {
  describe("listPlans", () => {
    it("ユーザーの計画一覧を取得する", async () => {
      const plans = [
        createMockPlanWithCount(),
        createMockPlanWithCount({ id: "plan-2", title: "管理会計学習計画", itemCount: 5 }),
      ]
      const repo = createMockRepo({
        findPlansByUser: vi.fn().mockResolvedValue(plans),
      })

      const result = await listPlans({ repo, logger: noopLogger }, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toHaveLength(2)
      expect(result.value[0].title).toBe("財務会計学習計画")
      expect(result.value[0].itemCount).toBe(3)
      expect(result.value[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it("フィルタ付きで計画一覧を取得する", async () => {
      const repo = createMockRepo({
        findPlansByUser: vi.fn().mockResolvedValue([]),
      })

      await listPlans({ repo, logger: noopLogger }, "user-1", { archived: true })

      expect(repo.findPlansByUser).toHaveBeenCalledWith("user-1", { archived: true })
    })

    it("計画がない場合は空配列を返す", async () => {
      const repo = createMockRepo({
        findPlansByUser: vi.fn().mockResolvedValue([]),
      })

      const result = await listPlans({ repo, logger: noopLogger }, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toEqual([])
    })
  })

  describe("getPlanDetail", () => {
    it("計画詳細を取得する", async () => {
      const plan = createMockPlan()
      const items = [createMockItem(), createMockItem({ id: "item-2", orderIndex: 1 })]
      const revisions = [createMockRevision()]
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        findPlanById: vi.fn().mockResolvedValue(plan),
        findItemsByPlan: vi.fn().mockResolvedValue(items),
        findRevisionsByPlan: vi.fn().mockResolvedValue(revisions),
      })

      const result = await getPlanDetail({ repo, logger: noopLogger }, "user-1", "plan-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.plan.id).toBe("plan-1")
      expect(result.value.items).toHaveLength(2)
      expect(result.value.revisions).toHaveLength(1)
    })

    it("他ユーザーの計画アクセスを拒否する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })

      const result = await getPlanDetail({ repo, logger: noopLogger }, "other-user", "plan-1")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })

    it("存在しない計画でエラーを返す", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        findPlanById: vi.fn().mockResolvedValue(null),
      })

      const result = await getPlanDetail({ repo, logger: noopLogger }, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("createPlan", () => {
    it("計画を作成する", async () => {
      const created = createMockPlan()
      const repo = createMockRepo({
        createPlan: vi.fn().mockResolvedValue(created),
      })

      const result = await createPlan({ repo, logger: noopLogger }, "user-1", {
        title: "財務会計学習計画",
        intent: "短答式対策",
        scope: "subject",
        subjectId: "subject-1",
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.title).toBe("財務会計学習計画")
      expect(result.value.scope).toBe("subject")
      expect(repo.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          title: "財務会計学習計画",
          scope: "subject",
        })
      )
    })

    it("intent無しで計画を作成する", async () => {
      const created = createMockPlan({ intent: null })
      const repo = createMockRepo({
        createPlan: vi.fn().mockResolvedValue(created),
      })

      const result = await createPlan({ repo, logger: noopLogger }, "user-1", {
        title: "シンプルな計画",
        scope: "all",
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.intent).toBeNull()
    })
  })

  describe("updatePlan", () => {
    it("計画を更新する", async () => {
      const updated = createMockPlan({ title: "更新後のタイトル" })
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        updatePlan: vi.fn().mockResolvedValue(updated),
      })

      const result = await updatePlan({ repo, logger: noopLogger }, "user-1", "plan-1", { title: "更新後のタイトル" })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.title).toBe("更新後のタイトル")
    })

    it("他ユーザーの計画更新を拒否する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })

      const result = await updatePlan({ repo, logger: noopLogger }, "other-user", "plan-1", { title: "不正な更新" })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })

    it("存在しない計画の更新でエラーを返す", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        updatePlan: vi.fn().mockResolvedValue(null),
      })

      const result = await updatePlan({ repo, logger: noopLogger }, "user-1", "non-existent", { title: "test" })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("archivePlan", () => {
    it("計画をアーカイブする", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        archivePlan: vi.fn().mockResolvedValue(true),
      })

      const result = await archivePlan({ repo, logger: noopLogger }, "user-1", "plan-1")

      expect(result.ok).toBe(true)
    })

    it("他ユーザーの計画アーカイブを拒否する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })

      const result = await archivePlan({ repo, logger: noopLogger }, "other-user", "plan-1")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })

    it("存在しない計画のアーカイブでエラーを返す", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        archivePlan: vi.fn().mockResolvedValue(false),
      })

      const result = await archivePlan({ repo, logger: noopLogger }, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("unarchivePlan", () => {
    it("計画のアーカイブを解除する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        unarchivePlan: vi.fn().mockResolvedValue(true),
      })

      const result = await unarchivePlan({ repo, logger: noopLogger }, "user-1", "plan-1")

      expect(result.ok).toBe(true)
    })

    it("他ユーザーの計画アーカイブ解除を拒否する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })

      const result = await unarchivePlan({ repo, logger: noopLogger }, "other-user", "plan-1")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("duplicatePlan", () => {
    it("計画を複製する", async () => {
      const duplicated = createMockPlan({ id: "plan-new", title: "財務会計学習計画（複製）" })
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        duplicatePlan: vi.fn().mockResolvedValue(duplicated),
      })

      const result = await duplicatePlan({ repo, logger: noopLogger }, "user-1", "plan-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.title).toBe("財務会計学習計画（複製）")
    })

    it("他ユーザーの計画複製を拒否する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })

      const result = await duplicatePlan({ repo, logger: noopLogger }, "other-user", "plan-1")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })

    it("存在しない計画の複製でエラーを返す", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        duplicatePlan: vi.fn().mockResolvedValue(null),
      })

      const result = await duplicatePlan({ repo, logger: noopLogger }, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("addItem", () => {
    it("計画に要素を追加する", async () => {
      const item = createMockItem()
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        createItem: vi.fn().mockResolvedValue(item),
      })

      const result = await addItem({ repo, logger: noopLogger }, "user-1", "plan-1", {
        topicId: "topic-1",
        description: "有価証券の分類と評価",
        rationale: "基礎的な論点",
        orderIndex: 0,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.description).toBe("有価証券の分類と評価")
    })

    it("他ユーザーの計画への要素追加を拒否する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })

      const result = await addItem({ repo, logger: noopLogger }, "other-user", "plan-1", {
        description: "test",
        orderIndex: 0,
      })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("updateItem", () => {
    it("要素を更新する", async () => {
      const updated = createMockItem({ description: "更新後の説明" })
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        updateItem: vi.fn().mockResolvedValue(updated),
      })

      const result = await updateItem({ repo, logger: noopLogger }, "user-1", "plan-1", "item-1", { description: "更新後の説明" })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.description).toBe("更新後の説明")
    })

    it("存在しない要素の更新でエラーを返す", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        updateItem: vi.fn().mockResolvedValue(null),
      })

      const result = await updateItem({ repo, logger: noopLogger }, "user-1", "plan-1", "non-existent", { description: "test" })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("removeItem", () => {
    it("要素を削除し変遷を記録する", async () => {
      const item = createMockItem()
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        findItemById: vi.fn().mockResolvedValue(item),
        deleteItem: vi.fn().mockResolvedValue(true),
        createRevision: vi.fn().mockResolvedValue(createMockRevision()),
      })

      const result = await removeItem({ repo, logger: noopLogger }, "user-1", "plan-1", "item-1")

      expect(result.ok).toBe(true)
      expect(repo.deleteItem).toHaveBeenCalledWith("item-1")
      expect(repo.createRevision).toHaveBeenCalledWith(
        expect.objectContaining({
          studyPlanId: "plan-1",
          summary: expect.stringContaining("有価証券の分類と評価"),
        })
      )
    })

    it("存在しない要素の削除でエラーを返す", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        findItemById: vi.fn().mockResolvedValue(null),
      })

      const result = await removeItem({ repo, logger: noopLogger }, "user-1", "plan-1", "non-existent")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })

    it("他ユーザーの計画の要素削除を拒否する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })

      const result = await removeItem({ repo, logger: noopLogger }, "other-user", "plan-1", "item-1")

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("reorderItems", () => {
    it("要素を並べ替える", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
      })

      const result = await reorderItems({ repo, logger: noopLogger }, "user-1", "plan-1", ["item-2", "item-1", "item-3"])

      expect(result.ok).toBe(true)
      expect(repo.reorderItems).toHaveBeenCalledWith("plan-1", ["item-2", "item-1", "item-3"])
    })

    it("他ユーザーの計画の並べ替えを拒否する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })

      const result = await reorderItems({ repo, logger: noopLogger }, "other-user", "plan-1", ["item-1"])

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("addRevision", () => {
    it("変遷記録を追加する", async () => {
      const revision = createMockRevision({ summary: "要素を追加", reason: "網羅性の向上" })
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        createRevision: vi.fn().mockResolvedValue(revision),
      })

      const result = await addRevision({ repo, logger: noopLogger }, "user-1", "plan-1", {
        summary: "要素を追加",
        reason: "網羅性の向上",
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.summary).toBe("要素を追加")
      expect(result.value.reason).toBe("網羅性の向上")
    })

    it("他ユーザーの計画への変遷追加を拒否する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })

      const result = await addRevision({ repo, logger: noopLogger }, "other-user", "plan-1", { summary: "test" })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  describe("updateRevision", () => {
    it("変遷記録の理由を更新する", async () => {
      const updated = createMockRevision({ reason: "追記された理由" })
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        updateRevision: vi.fn().mockResolvedValue(updated),
      })

      const result = await updateRevision({ repo, logger: noopLogger }, "user-1", "plan-1", "revision-1", { reason: "追記された理由" })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.reason).toBe("追記された理由")
    })

    it("存在しない変遷の更新でエラーを返す", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        updateRevision: vi.fn().mockResolvedValue(null),
      })

      const result = await updateRevision({ repo, logger: noopLogger }, "user-1", "plan-1", "non-existent", { reason: "test" })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })

    it("他ユーザーの計画の変遷更新を拒否する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(false),
      })

      const result = await updateRevision({ repo, logger: noopLogger }, "other-user", "plan-1", "revision-1", { reason: "test" })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe("NOT_FOUND")
    })
  })

  // === 境界値テスト ===

  describe("archivePlan 境界値", () => {
    it("既にアーカイブ済みのプランを再アーカイブ→repoが成功を返せば冪等に完了する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        archivePlan: vi.fn().mockResolvedValue(true),
      })

      const result = await archivePlan({ repo, logger: noopLogger }, "user-1", "plan-1")

      expect(result.ok).toBe(true)
      expect(repo.archivePlan).toHaveBeenCalledWith("plan-1")
    })
  })

  describe("duplicatePlan 境界値", () => {
    it("items=0のプランを複製→空itemsのプランが作られる", async () => {
      const duplicated = createMockPlan({ id: "plan-dup", title: "空の計画（複製）" })
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
        duplicatePlan: vi.fn().mockResolvedValue(duplicated),
      })

      const result = await duplicatePlan({ repo, logger: noopLogger }, "user-1", "plan-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.title).toBe("空の計画（複製）")
      expect(repo.duplicatePlan).toHaveBeenCalledWith(
        "plan-1",
        expect.any(String),
        "user-1"
      )
    })
  })

  describe("reorderItems 境界値", () => {
    it("1要素のみの並べ替え→正常に完了する", async () => {
      const repo = createMockRepo({
        isPlanOwnedByUser: vi.fn().mockResolvedValue(true),
      })

      const result = await reorderItems({ repo, logger: noopLogger }, "user-1", "plan-1", ["item-1"])

      expect(result.ok).toBe(true)
      expect(repo.reorderItems).toHaveBeenCalledWith("plan-1", ["item-1"])
    })
  })
})
