import { test as setup, expect } from "@playwright/test"
import path from "path"

const authFile = path.resolve(__dirname, "../.auth/user.json")

setup("authenticate via dev-login", async ({ page, request }) => {
  // テスト前にDBをリセット（前回テスト実行の状態をクリア）
  await request.post("http://localhost:4567/api/test/reset")

  await page.goto("/login")

  // dev login ボタンをクリック
  await page.getByRole("button", { name: "テストユーザーでログイン" }).click()

  // ダッシュボードにリダイレクトされ、挨拶が表示される
  await expect(page.getByText("こんにちは")).toBeVisible({ timeout: 15000 })

  // 認証状態を保存
  await page.context().storageState({ path: authFile })
})
