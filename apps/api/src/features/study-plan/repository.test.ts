import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, seedTestData, type TestDatabase } from "../../test/mocks/db"
import { createStudyPlanRepository, type StudyPlanRepository } from "./repository"

describe("StudyPlanRepository", () => {
  let repository: StudyPlanRepository
  let testData: ReturnType<typeof seedTestData>
  let db: TestDatabase

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    testData = seedTestData(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createStudyPlanRepository(db as any)
  })

  describe("createPlan", () => {
    it("計画を作成できる", async () => {
      const now = new Date()
      const plan = await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "財務会計学習計画",
        intent: "短答式対策",
        scope: "subject",
        subjectId: testData.subjectId,
        now,
      })

      expect(plan.id).toBe("plan-1")
      expect(plan.userId).toBe(testData.userId)
      expect(plan.title).toBe("財務会計学習計画")
      expect(plan.intent).toBe("短答式対策")
      expect(plan.scope).toBe("subject")
      expect(plan.subjectId).toBe(testData.subjectId)
      expect(plan.subjectName).toBe("財務会計論")
      expect(plan.archivedAt).toBeNull()
    })

    it("intent無しで計画を作成できる", async () => {
      const plan = await repository.createPlan({
        id: "plan-2",
        userId: testData.userId,
        title: "シンプルな計画",
        scope: "all",
        now: new Date(),
      })

      expect(plan.intent).toBeNull()
      expect(plan.subjectId).toBeNull()
      expect(plan.subjectName).toBeNull()
    })
  })

  describe("findPlanById", () => {
    it("IDで計画を取得できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "テスト計画",
        scope: "all",
        now: new Date(),
      })

      const found = await repository.findPlanById("plan-1")

      expect(found).not.toBeNull()
      expect(found?.id).toBe("plan-1")
      expect(found?.title).toBe("テスト計画")
    })

    it("存在しない計画はnullを返す", async () => {
      const found = await repository.findPlanById("non-existent")

      expect(found).toBeNull()
    })
  })

  describe("findPlansByUser", () => {
    it("ユーザーの計画一覧を取得できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画1",
        scope: "all",
        now: new Date(),
      })
      await repository.createPlan({
        id: "plan-2",
        userId: testData.userId,
        title: "計画2",
        scope: "subject",
        subjectId: testData.subjectId,
        now: new Date(),
      })

      const plans = await repository.findPlansByUser(testData.userId)

      expect(plans).toHaveLength(2)
      plans.forEach((p) => {
        expect(p.userId).toBe(testData.userId)
        expect(typeof p.itemCount).toBe("number")
      })
    })

    it("アーカイブ済みフィルタが機能する", async () => {
      await repository.createPlan({
        id: "plan-active",
        userId: testData.userId,
        title: "アクティブ計画",
        scope: "all",
        now: new Date(),
      })
      await repository.createPlan({
        id: "plan-archived",
        userId: testData.userId,
        title: "アーカイブ済み計画",
        scope: "all",
        now: new Date(),
      })
      await repository.archivePlan("plan-archived")

      const activePlans = await repository.findPlansByUser(testData.userId, { archived: false })
      const archivedPlans = await repository.findPlansByUser(testData.userId, { archived: true })

      expect(activePlans.every((p) => p.archivedAt === null)).toBe(true)
      expect(archivedPlans.every((p) => p.archivedAt !== null)).toBe(true)
    })

    it("itemCountが正しく算出される", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })
      await repository.createItem({
        id: "item-1",
        studyPlanId: "plan-1",
        description: "要素1",
        orderIndex: 0,
        now: new Date(),
      })
      await repository.createItem({
        id: "item-2",
        studyPlanId: "plan-1",
        description: "要素2",
        orderIndex: 1,
        now: new Date(),
      })

      const plans = await repository.findPlansByUser(testData.userId)

      expect(plans[0].itemCount).toBe(2)
    })

    it("計画がない場合は空配列を返す", async () => {
      const plans = await repository.findPlansByUser("user-with-no-plans")

      expect(plans).toHaveLength(0)
    })
  })

  describe("updatePlan", () => {
    it("計画のタイトルを更新できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "元のタイトル",
        scope: "all",
        now: new Date(),
      })

      const updated = await repository.updatePlan("plan-1", { title: "更新後のタイトル" })

      expect(updated).not.toBeNull()
      expect(updated?.title).toBe("更新後のタイトル")
    })

    it("intentをnullに更新できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        intent: "元のintent",
        scope: "all",
        now: new Date(),
      })

      const updated = await repository.updatePlan("plan-1", { intent: null })

      expect(updated).not.toBeNull()
      expect(updated?.intent).toBeNull()
    })

    it("存在しない計画の更新はnullを返す", async () => {
      const updated = await repository.updatePlan("non-existent", { title: "test" })

      expect(updated).toBeNull()
    })
  })

  describe("archivePlan / unarchivePlan", () => {
    it("計画をアーカイブできる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })

      const success = await repository.archivePlan("plan-1")

      expect(success).toBe(true)
      const plan = await repository.findPlanById("plan-1")
      expect(plan?.archivedAt).not.toBeNull()
    })

    it("計画のアーカイブを解除できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })
      await repository.archivePlan("plan-1")

      const success = await repository.unarchivePlan("plan-1")

      expect(success).toBe(true)
      const plan = await repository.findPlanById("plan-1")
      expect(plan?.archivedAt).toBeNull()
    })

    it("存在しない計画のアーカイブはfalseを返す", async () => {
      const success = await repository.archivePlan("non-existent")

      expect(success).toBe(false)
    })

    it("存在しない計画のアーカイブ解除はfalseを返す", async () => {
      const success = await repository.unarchivePlan("non-existent")

      expect(success).toBe(false)
    })
  })

  describe("duplicatePlan", () => {
    it("計画を複製できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "元の計画",
        intent: "テスト用",
        scope: "subject",
        subjectId: testData.subjectId,
        now: new Date(),
      })
      await repository.createItem({
        id: "item-1",
        studyPlanId: "plan-1",
        description: "要素1",
        orderIndex: 0,
        now: new Date(),
      })

      const duplicated = await repository.duplicatePlan("plan-1", "plan-new", testData.userId)

      expect(duplicated).not.toBeNull()
      expect(duplicated?.id).toBe("plan-new")
      expect(duplicated?.title).toContain("（複製）")
      expect(duplicated?.archivedAt).toBeNull()

      // 要素も複製されていることを確認
      const items = await repository.findItemsByPlan("plan-new")
      expect(items).toHaveLength(1)
      expect(items[0].description).toBe("要素1")
    })

    it("存在しない計画の複製はnullを返す", async () => {
      const duplicated = await repository.duplicatePlan("non-existent", "plan-new", testData.userId)

      expect(duplicated).toBeNull()
    })
  })

  describe("createItem / findItemsByPlan / findItemById", () => {
    it("要素を作成して取得できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })

      const item = await repository.createItem({
        id: "item-1",
        studyPlanId: "plan-1",
        topicId: testData.topicId,
        description: "有価証券の学習",
        rationale: "基礎論点のため",
        orderIndex: 0,
        now: new Date(),
      })

      expect(item.id).toBe("item-1")
      expect(item.description).toBe("有価証券の学習")
      expect(item.topicName).toBe("有価証券")
    })

    it("計画の要素一覧を取得できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })
      await repository.createItem({
        id: "item-1",
        studyPlanId: "plan-1",
        description: "要素1",
        orderIndex: 1,
        now: new Date(),
      })
      await repository.createItem({
        id: "item-2",
        studyPlanId: "plan-1",
        description: "要素2",
        orderIndex: 0,
        now: new Date(),
      })

      const items = await repository.findItemsByPlan("plan-1")

      expect(items).toHaveLength(2)
      // orderIndex昇順で取得されることを確認
      expect(items[0].orderIndex).toBe(0)
      expect(items[1].orderIndex).toBe(1)
    })

    it("IDで要素を取得できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })
      await repository.createItem({
        id: "item-1",
        studyPlanId: "plan-1",
        description: "テスト要素",
        orderIndex: 0,
        now: new Date(),
      })

      const found = await repository.findItemById("item-1")

      expect(found).not.toBeNull()
      expect(found?.description).toBe("テスト要素")
    })

    it("存在しない要素はnullを返す", async () => {
      const found = await repository.findItemById("non-existent")

      expect(found).toBeNull()
    })
  })

  describe("updateItem", () => {
    it("要素を更新できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })
      await repository.createItem({
        id: "item-1",
        studyPlanId: "plan-1",
        description: "元の説明",
        orderIndex: 0,
        now: new Date(),
      })

      const updated = await repository.updateItem("item-1", { description: "更新後の説明" })

      expect(updated).not.toBeNull()
      expect(updated?.description).toBe("更新後の説明")
    })

    it("存在しない要素の更新はnullを返す", async () => {
      const updated = await repository.updateItem("non-existent", { description: "test" })

      expect(updated).toBeNull()
    })
  })

  describe("deleteItem", () => {
    it("要素を削除できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })
      await repository.createItem({
        id: "item-1",
        studyPlanId: "plan-1",
        description: "削除対象",
        orderIndex: 0,
        now: new Date(),
      })

      const success = await repository.deleteItem("item-1")

      expect(success).toBe(true)
      const found = await repository.findItemById("item-1")
      expect(found).toBeNull()
    })

    it("存在しない要素の削除はfalseを返す", async () => {
      const success = await repository.deleteItem("non-existent")

      expect(success).toBe(false)
    })
  })

  describe("reorderItems", () => {
    it("要素を並べ替えできる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })
      await repository.createItem({
        id: "item-a",
        studyPlanId: "plan-1",
        description: "A",
        orderIndex: 0,
        now: new Date(),
      })
      await repository.createItem({
        id: "item-b",
        studyPlanId: "plan-1",
        description: "B",
        orderIndex: 1,
        now: new Date(),
      })

      await repository.reorderItems("plan-1", ["item-b", "item-a"])

      const items = await repository.findItemsByPlan("plan-1")
      expect(items[0].id).toBe("item-b")
      expect(items[0].orderIndex).toBe(0)
      expect(items[1].id).toBe("item-a")
      expect(items[1].orderIndex).toBe(1)
    })
  })

  describe("createRevision / findRevisionsByPlan", () => {
    it("変遷記録を作成して取得できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })

      const revision = await repository.createRevision({
        id: "revision-1",
        studyPlanId: "plan-1",
        summary: "初期計画策定",
        reason: "学習開始のため",
        now: new Date(),
      })

      expect(revision.id).toBe("revision-1")
      expect(revision.summary).toBe("初期計画策定")
      expect(revision.reason).toBe("学習開始のため")

      const revisions = await repository.findRevisionsByPlan("plan-1")
      expect(revisions).toHaveLength(1)
    })

    it("reason無しで変遷記録を作成できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })

      const revision = await repository.createRevision({
        id: "revision-1",
        studyPlanId: "plan-1",
        summary: "要素を追加",
        now: new Date(),
      })

      expect(revision.reason).toBeNull()
    })
  })

  describe("updateRevision", () => {
    it("変遷記録のreasonを更新できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })
      await repository.createRevision({
        id: "revision-1",
        studyPlanId: "plan-1",
        summary: "テスト",
        now: new Date(),
      })

      const updated = await repository.updateRevision("revision-1", { reason: "理由を追記" })

      expect(updated).not.toBeNull()
      expect(updated?.reason).toBe("理由を追記")
    })

    it("reasonをnullに更新できる", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })
      await repository.createRevision({
        id: "revision-1",
        studyPlanId: "plan-1",
        summary: "テスト",
        reason: "元の理由",
        now: new Date(),
      })

      const updated = await repository.updateRevision("revision-1", { reason: null })

      expect(updated).not.toBeNull()
      expect(updated?.reason).toBeNull()
    })

    it("存在しない変遷の更新はnullを返す", async () => {
      const updated = await repository.updateRevision("non-existent", { reason: "test" })

      expect(updated).toBeNull()
    })
  })

  describe("isPlanOwnedByUser", () => {
    it("所有者の場合trueを返す", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })

      const owned = await repository.isPlanOwnedByUser("plan-1", testData.userId)

      expect(owned).toBe(true)
    })

    it("所有者でない場合falseを返す", async () => {
      await repository.createPlan({
        id: "plan-1",
        userId: testData.userId,
        title: "計画",
        scope: "all",
        now: new Date(),
      })

      const owned = await repository.isPlanOwnedByUser("plan-1", "other-user")

      expect(owned).toBe(false)
    })

    it("存在しない計画はfalseを返す", async () => {
      const owned = await repository.isPlanOwnedByUser("non-existent", testData.userId)

      expect(owned).toBe(false)
    })
  })
})
