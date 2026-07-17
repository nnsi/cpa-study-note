import { test, expect } from "@playwright/test"

// 目次インポートAPI（createTocImportFeature）がe2eサーバに登録されていることの疎通確認。
// UIフロー（画像アップロード→AI提案）はモックAI経由でも重いため、
// ここではルーティング登録の確認に留める。

test.describe("目次インポートAPI", () => {
  test("認証済みでエンドポイントが404にならない", async ({ request }) => {
    const response = await request.post(
      "http://localhost:4567/api/toc-import/subjects/subject-1/suggest",
      {
        headers: { "X-Dev-User-Id": "test-user-1" },
        data: { imageIds: [] },
      }
    )

    // imageIds: [] はバリデーションエラー（400）になるが、
    // ルートが登録されていること（404でないこと）を確認できれば十分
    expect(response.status()).not.toBe(404)
  })

  test("未認証では401を返す（ルートは存在する）", async ({ request }) => {
    const response = await request.post(
      "http://localhost:4567/api/toc-import/subjects/subject-1/suggest",
      {
        data: { imageIds: ["image-1"] },
      }
    )

    expect(response.status()).toBe(401)
  })
})
