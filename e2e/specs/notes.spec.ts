import { test, expect } from "@playwright/test"

test.describe("ノート", () => {
  test("チャットからノートを作成し、ノート詳細で確認", async ({ page }) => {
    // トピックページでチャット → ノート作成
    await page.goto("/domains/cpa/subjects/subject-1/category-1/topic-1")
    await expect(page.getByRole("heading", { name: "有価証券" })).toBeVisible({ timeout: 15000 })

    // PCレイアウト: チャット入力は常時表示
    const input = page.getByRole("textbox", { name: "Shift+Enterで改行" })
    await expect(input).toBeVisible({ timeout: 10000 })

    await input.fill("ノート作成テスト用の質問です")
    await input.press("Enter")

    // AI応答を待つ
    await expect(page.getByText("ご質問ありがとうございます").first()).toBeVisible({ timeout: 15000 })

    // PC版ノート作成ボタン
    const createNote = page.getByRole("button", { name: "この会話からノートを作成" })
    await expect(createNote).toBeVisible({ timeout: 5000 })
    await createNote.click()

    // PC版: 作成後は「ノートに記録済み」+「確認する」リンク
    await expect(page.getByText("ノートに記録済み").first()).toBeVisible({ timeout: 10000 })

    // ノート詳細へ遷移
    const noteLink = page.getByRole("link", { name: "確認する" }).first()
    await expect(noteLink).toBeVisible()
    await noteLink.click()
    await expect(page.getByText("AI要約")).toBeVisible({ timeout: 10000 })
  })

  test("ノート一覧ページが表示される", async ({ page }) => {
    await page.goto("/notes")
    await expect(page.getByRole("heading", { name: "ノート", exact: true })).toBeVisible({ timeout: 15000 })

    // ノートがあるか空メッセージ
    const hasNotes = page.locator("main a").first()
    const emptyMsg = page.getByText("まだノートがありません")
    await expect(hasNotes.or(emptyMsg)).toBeVisible({ timeout: 5000 })
  })
})
