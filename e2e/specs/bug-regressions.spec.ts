import { test, expect, type Page } from "@playwright/test"

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
)

const watchPageErrors = (page: Page) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  return errors
}

test.describe("バグ修正のブラウザ回帰確認", () => {
  test("未認証では保護画面とグローバル検索を利用できない", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()
    const pageErrors = watchPageErrors(page)
    let searchRequestCount = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/view/search")) searchRequestCount += 1
    })

    for (const path of ["/plans", "/plans/missing-plan", "/exercises"]) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    }

    await page.goto("/")
    await page.keyboard.press("Meta+K")
    await expect(page.getByPlaceholder("論点名を検索...")).toHaveCount(0)
    expect(searchRequestCount).toBe(0)
    expect(pageErrors).toEqual([])
    await context.close()
  })

  test("検索・旧URL・サイドバーが正しい学習ドメインを維持する", async ({ page }) => {
    const pageErrors = watchPageErrors(page)

    await page.goto("/")
    await page.getByRole("button", { name: /検索/ }).click()
    await page.getByPlaceholder("論点名を検索...").fill("有価証券")
    await page.getByRole("button", { name: /有価証券/ }).click()
    await expect(page).toHaveURL(
      /\/domains\/cpa\/subjects\/subject-1\/category-1\/topic-1$/
    )

    const studyLink = page.locator("aside").getByRole("link", { name: "学習" })
    await expect(studyLink).toHaveClass(/nav-item-active/)

    await page.goto("/subjects/subject-1/category-1/topic-1")
    await expect(page).toHaveURL(
      /\/domains\/cpa\/subjects\/subject-1\/category-1\/topic-1$/
    )
    expect(pageErrors).toEqual([])
  })

  test("復習条件をAPIへ送り、ドメイン付きの結果リンクを開ける", async ({ page }) => {
    const pageErrors = watchPageErrors(page)
    await page.goto("/review")
    await expect(page.getByRole("heading", { name: "論点フィルタ" })).toBeVisible()

    const numberInputs = page.locator('input[type="number"]')
    await numberInputs.nth(0).fill("1")
    await numberInputs.nth(2).fill("2")

    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === "/api/view/topics" &&
        url.searchParams.get("minSessionCount") === "1" &&
        url.searchParams.get("minGoodQuestionCount") === "2"
      )
    })
    await page.getByRole("button", { name: "検索", exact: true }).click()
    expect((await responsePromise).status()).toBe(200)
    await expect(page).toHaveURL(/minSessionCount=/)
    await expect(page).toHaveURL(/minGoodQuestionCount=/)
    expect(pageErrors).toEqual([])
  })

  test("401後にストリームを再送し、認証画像をチャットに表示する", async ({ page }) => {
    const pageErrors = watchPageErrors(page)
    let streamAttempts = 0
    await page.route("**/api/chat/**/messages/stream", async (route) => {
      streamAttempts += 1
      if (streamAttempts === 1) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          headers: {
            "Access-Control-Allow-Origin": "http://localhost:4568",
            "Access-Control-Allow-Credentials": "true",
          },
          body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "expired" } }),
        })
        return
      }
      await route.continue()
    })

    await page.goto("/domains/cpa/subjects/subject-1/category-1/topic-1")
    const input = page.getByRole("textbox", { name: "Shift+Enterで改行" })
    await input.fill("トークン更新テスト")
    const streamResponse = page.waitForResponse(
      (response) => response.url().includes("/messages/stream") && response.status() === 200
    )
    await input.press("Enter")
    await streamResponse
    await expect.poll(() => streamAttempts).toBe(2)
    await expect(page.getByText("トークン更新テスト")).toBeVisible()

    await page.getByTitle("画像をアップロード").click()
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "question.png",
      mimeType: "image/png",
      buffer: onePixelPng,
    })
    await page.getByRole("button", { name: "この画像を使用" }).click()
    await page.locator("textarea").fill("添付画像の確認")

    const imageResponse = page.waitForResponse(
      (response) => /\/api\/images\/[^/]+\/file$/.test(new URL(response.url()).pathname)
    )
    await page.locator("textarea").press("Enter")
    expect((await imageResponse).status()).toBe(200)

    const attachedImage = page.getByAltText("添付画像")
    await expect(attachedImage).toBeVisible()
    expect(await attachedImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    expect(pageErrors).toEqual([])
  })

  test("演習画像を確定し、選択した論点と認証サムネイルを開ける", async ({ page }) => {
    const pageErrors = watchPageErrors(page)
    await page.goto("/exercises")
    await expect(page.getByRole("heading", { name: "問題を追加" })).toBeVisible()

    await page.locator('input[type="file"]').first().setInputFiles({
      name: "exercise.png",
      mimeType: "image/png",
      buffer: onePixelPng,
    })
    await page.getByRole("button", { name: "別の論点を選ぶ..." }).click()
    await page.getByPlaceholder("論点名で検索...").fill("有価証券")
    await page.getByRole("button", { name: /有価証券/ }).click()

    await expect(page.getByRole("heading", { name: "保存しました" })).toBeVisible()
    await page.getByRole("button", { name: "論点を見る" }).click()
    await expect(page).toHaveURL(
      /\/domains\/cpa\/subjects\/subject-1\/category-1\/topic-1$/
    )

    await page.getByRole("button", { name: "問題", exact: true }).click()
    const exerciseImage = page.getByAltText("問題画像")
    await expect(exerciseImage).toBeVisible()
    expect(await exerciseImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    expect(pageErrors).toEqual([])
  })
})
