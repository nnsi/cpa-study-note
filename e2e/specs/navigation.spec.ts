import { test, expect } from "@playwright/test"

test.describe("ダッシュボードとナビゲーション", () => {
  test("ダッシュボードが正しく表示される", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("こんにちは")).toBeVisible({ timeout: 15000 })

    // クイックアクセスカード
    await expect(page.getByRole("heading", { name: "学習計画" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "論点マップ" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "論点フィルタ" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "問題チェック" })).toBeVisible()

    // 今日の活動
    await expect(page.getByRole("heading", { name: "今日の活動" })).toBeVisible()
  })

  test("論点マップから科目一覧ページへ遷移", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("こんにちは")).toBeVisible({ timeout: 15000 })

    // カード「論点マップ 科目・論点を選んで学習」をクリック（「論点マップを見る」リンクとの重複回避）
    await page.getByRole("link", { name: "論点マップ 科目・論点を選んで学習" }).click()
    await expect(page).toHaveURL(/\/subjects/)
    await expect(page.getByRole("heading", { name: "科目一覧" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "財務会計論" })).toBeVisible()
  })

  test("科目一覧で科目カードが展開される", async ({ page }) => {
    await page.goto("/domains/cpa/subjects")
    await expect(page.getByRole("heading", { name: "科目一覧" })).toBeVisible({ timeout: 15000 })

    await page.getByRole("button", { name: /財務会計論/ }).click()
    await expect(page.getByText("単元がありません")).toBeVisible()
  })

  test("トピックページに直接遷移できる", async ({ page }) => {
    await page.goto("/domains/cpa/subjects/subject-1/category-1/topic-1")
    await expect(page.getByRole("heading", { name: "有価証券" })).toBeVisible({ timeout: 15000 })
    await expect(page).toHaveURL(/topic-1/)
  })

  test("ノート一覧ページへ遷移", async ({ page }) => {
    await page.goto("/notes")
    // exact: true で「まだノートがありません」のh3ヘッディングとの重複回避
    await expect(page.getByRole("heading", { name: "ノート", exact: true })).toBeVisible({ timeout: 15000 })
  })

  test("サイドバーナビゲーションで遷移できる", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("こんにちは")).toBeVisible({ timeout: 15000 })

    // PCレイアウト: aside内のサイドバーリンクを使う
    await page.locator("aside").getByRole("link", { name: "学習" }).click()
    await expect(page.getByRole("heading", { name: "科目一覧" })).toBeVisible()

    await page.locator("aside").getByRole("link", { name: "ノート" }).click()
    await expect(page.getByRole("heading", { name: "ノート", exact: true })).toBeVisible()

    await page.locator("aside").getByRole("link", { name: "ホーム" }).click()
    await expect(page.getByText("こんにちは")).toBeVisible()
  })
})
