import { test, expect } from "@playwright/test"

test.describe("ブックマーク", () => {
  test("トピックをブックマークして解除できる", async ({ page }) => {
    await page.goto("/domains/cpa/subjects/subject-1/category-1/topic-1")
    await expect(page.getByRole("heading", { name: "有価証券" })).toBeVisible({ timeout: 15000 })

    // PCレイアウト: サイドバーの情報タブ（デフォルト選択済み）
    await page.getByRole("button", { name: "情報" }).click()

    // ブックマーク追加ボタンが表示されるまで待つ
    const addBtn = page.getByRole("button", { name: "ブックマークに追加" })
    await expect(addBtn).toBeVisible({ timeout: 10000 })
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/bookmarks") && resp.ok()),
      addBtn.click(),
    ])

    // ブックマーク解除ボタンに変わる
    await expect(page.getByRole("button", { name: "ブックマークを解除" })).toBeVisible({ timeout: 10000 })

    // ダッシュボードでブックマーク確認
    await page.goto("/")
    await expect(page.getByText("こんにちは")).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole("link", { name: /有価証券/ }).first()).toBeVisible({ timeout: 5000 })

    // 戻ってブックマーク解除
    await page.goto("/domains/cpa/subjects/subject-1/category-1/topic-1")
    await expect(page.getByRole("heading", { name: "有価証券" })).toBeVisible({ timeout: 15000 })
    await page.getByRole("button", { name: "情報" }).click()

    const removeBtn = page.getByRole("button", { name: "ブックマークを解除" })
    await expect(removeBtn).toBeVisible({ timeout: 5000 })

    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/bookmarks") && resp.ok()),
      removeBtn.click(),
    ])

    await expect(page.getByRole("button", { name: "ブックマークに追加" })).toBeVisible({ timeout: 10000 })
  })
})
