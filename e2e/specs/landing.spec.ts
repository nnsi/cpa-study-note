import { test, expect } from "@playwright/test"

// 未認証状態のテスト（storageStateを使わない）
test.use({ storageState: { cookies: [], origins: [] } })

test.describe("ランディングページ", () => {
  test("未認証でランディングが表示される", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "InkTopik", level: 1 })).toBeVisible()
    await expect(page.getByText("学習の痕跡を、論点に残す")).toBeVisible()
  })

  test("「はじめる」からログインページへ遷移", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: "はじめる" }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole("heading", { name: "InkTopik にログイン" })).toBeVisible()
    await expect(page.getByRole("button", { name: "テストユーザーでログイン" })).toBeVisible()
  })

  test("認証が必要なページは /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/domains/cpa/subjects/subject-1/category-1/topic-1")
    await expect(page).toHaveURL(/\/login/)
  })
})
