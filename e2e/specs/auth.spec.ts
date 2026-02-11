import { test, expect } from "@playwright/test"

// ログイン・ログアウトは未認証から開始
test.use({ storageState: { cookies: [], origins: [] } })

test.describe("認証フロー", () => {
  test("dev-login でダッシュボードに遷移", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("button", { name: "テストユーザーでログイン" }).click()

    // ダッシュボードに遷移
    await expect(page.getByText("こんにちは")).toBeVisible({ timeout: 15000 })
    await expect(page).toHaveURL("/")
  })

  test("ログアウトでランディングに戻る", async ({ page }) => {
    // まずログイン
    await page.goto("/login")
    await page.getByRole("button", { name: "テストユーザーでログイン" }).click()
    await expect(page.getByText("こんにちは")).toBeVisible({ timeout: 15000 })

    // ユーザーアイコンをクリックしてメニューを開く
    const avatar = page.locator("header").getByRole("button").last()
    await avatar.click()

    // ログアウトをクリック
    await page.getByText("ログアウト").click()

    // ランディングに戻る
    await expect(page.getByRole("heading", { name: "InkTopik", level: 1 })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("学習の痕跡を、論点に残す")).toBeVisible()
  })
})
