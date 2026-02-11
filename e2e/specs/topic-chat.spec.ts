import { test, expect } from "@playwright/test"

// Desktop Chrome (1280x720) ではPCレイアウト:
// - サイドバータブ: 情報 / 履歴 / ノート / 問題
// - メイン: チャットが常時表示（「チャット」タブは存在しない）

test.describe("トピック詳細とチャット", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/domains/cpa/subjects/subject-1/category-1/topic-1")
    await expect(page.getByRole("heading", { name: "有価証券" })).toBeVisible({ timeout: 15000 })
  })

  test("情報タブにトピック情報が表示される", async ({ page }) => {
    // PCレイアウト: サイドバーの「情報」タブをクリック（デフォルト選択済みだが念のため）
    await page.getByRole("button", { name: "情報" }).click()
    await expect(page.getByText("有価証券の評価と会計処理")).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole("heading", { name: "学習統計" })).toBeVisible()
    await expect(page.getByRole("button", { name: /理解済みとしてマーク/ })).toBeVisible()
  })

  test("チャットでメッセージ送信→AI応答を受信", async ({ page }) => {
    // PCレイアウトではチャット入力が常時表示
    const input = page.getByRole("textbox", { name: "Shift+Enterで改行" })
    await expect(input).toBeVisible({ timeout: 10000 })

    await input.fill("有価証券の分類を教えてください")
    await input.press("Enter")

    // AI応答を待つ（mock AIは固定テキストを返す）
    await expect(page.getByText("ご質問ありがとうございます").first()).toBeVisible({ timeout: 15000 })

    // セッションが作成されている（サイドバーの「履歴」タブで確認）
    await page.getByRole("button", { name: "履歴" }).click()
    await expect(page.getByText(/\d+件/).first()).toBeVisible({ timeout: 5000 })
  })

  test("チャット後にノートを作成できる", async ({ page }) => {
    // 新しいセッションを開始（共有DB状態対策）
    await page.getByRole("button", { name: "履歴" }).click()
    await page.getByRole("button", { name: /新しいチャットを開始/ }).click()

    const input = page.getByRole("textbox", { name: "Shift+Enterで改行" })
    await expect(input).toBeVisible({ timeout: 10000 })

    await input.fill("テスト質問")
    await input.press("Enter")
    await expect(page.getByText("ご質問ありがとうございます").first()).toBeVisible({ timeout: 15000 })

    // PC版ノート作成ボタン
    const createNote = page.getByRole("button", { name: "この会話からノートを作成" })
    await expect(createNote).toBeVisible({ timeout: 5000 })
    await createNote.click()

    // PC版: ノート作成後は「ノートに記録済み」+ 「確認する」リンク
    await expect(page.getByText("ノートに記録済み").first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("link", { name: "確認する" }).first()).toBeVisible()
  })

  test("サイドバータブ切り替えが動作する", async ({ page }) => {
    // 情報タブ（デフォルト）
    await page.getByRole("button", { name: "情報" }).click()
    await expect(page.getByText("有価証券の評価と会計処理")).toBeVisible({ timeout: 5000 })

    // 履歴タブ
    await page.getByRole("button", { name: "履歴" }).click()
    // セッション一覧: 「+ 新しいチャットを開始」ボタンは常に表示される
    await expect(
      page.getByRole("button", { name: /新しいチャットを開始/ })
    ).toBeVisible({ timeout: 5000 })

    // ノートタブ（exact: trueでセッション名に「ノート」を含むボタンとの重複回避）
    await page.getByRole("button", { name: "ノート", exact: true }).click()
    await expect(
      page.getByText("ノートはまだありません").or(page.getByText("ノートに記録済み").first())
    ).toBeVisible({ timeout: 5000 })
  })
})
