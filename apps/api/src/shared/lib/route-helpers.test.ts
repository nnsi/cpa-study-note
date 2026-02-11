import { describe, it, expect, vi } from "vitest"
import { Hono } from "hono"
import { errorResponse, handleResult, handleResultWith } from "./route-helpers"
import { ok, err } from "./result"
import type { AppError } from "./errors"

// テスト用Honoアプリを作成してContextを取得するヘルパー
const executeWithContext = async (
  handler: (c: any) => Response | Promise<Response>
): Promise<Response> => {
  const app = new Hono()
  app.get("/test", (c) => handler(c))
  const res = await app.request("/test")
  return res
}

describe("errorResponse", () => {
  it("NOT_FOUNDエラーを404レスポンスに変換する", async () => {
    const error: AppError = { code: "NOT_FOUND", message: "見つかりません" }
    const res = await executeWithContext((c) => errorResponse(c, error))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")
    expect(body.error.message).toBe("見つかりません")
  })

  it("BAD_REQUESTエラーを400レスポンスに変換する", async () => {
    const error: AppError = { code: "BAD_REQUEST", message: "不正なリクエスト" }
    const res = await executeWithContext((c) => errorResponse(c, error))
    expect(res.status).toBe(400)
  })

  it("detailsを含むエラーレスポンスを返す", async () => {
    const error: AppError = {
      code: "BAD_REQUEST",
      message: "バリデーションエラー",
      details: { field: "name" },
    }
    const res = await executeWithContext((c) => errorResponse(c, error))
    const body = await res.json()
    expect(body.error.details).toEqual({ field: "name" })
  })

  it("detailsがない場合はレスポンスに含めない", async () => {
    const error: AppError = { code: "INTERNAL_ERROR", message: "内部エラー" }
    const res = await executeWithContext((c) => errorResponse(c, error))
    const body = await res.json()
    expect(body.error.details).toBeUndefined()
  })
})

describe("handleResult", () => {
  it("ok結果を200レスポンスに変換する", async () => {
    const result = ok({ name: "テスト" })
    const res = await executeWithContext((c) => handleResult(c, result))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ name: "テスト" })
  })

  it("ok結果を201レスポンスに変換できる", async () => {
    const result = ok({ id: "new-1" })
    const res = await executeWithContext((c) => handleResult(c, result, 201))
    expect(res.status).toBe(201)
  })

  it("successStatusが204の場合は空ボディで返す", async () => {
    const result = ok(undefined)
    const res = await executeWithContext((c) => handleResult(c, result, 204))
    expect(res.status).toBe(204)
  })

  it("値がundefinedの場合は204で返す", async () => {
    const result = ok(undefined)
    const res = await executeWithContext((c) => handleResult(c, result))
    expect(res.status).toBe(204)
  })

  it("err結果を対応するHTTPステータスで返す", async () => {
    const error: AppError = { code: "FORBIDDEN", message: "アクセス禁止" }
    const result = err(error)
    const res = await executeWithContext((c) => handleResult(c, result))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("FORBIDDEN")
  })

  it("err結果のdetailsを含める", async () => {
    const error: AppError = {
      code: "CONFLICT",
      message: "競合",
      details: { existing: "data" },
    }
    const result = err(error)
    const res = await executeWithContext((c) => handleResult(c, result))
    const body = await res.json()
    expect(body.error.details).toEqual({ existing: "data" })
  })
})

describe("handleResultWith", () => {
  it("ok結果をtransformして200レスポンスに変換する", async () => {
    const result = ok({ id: "1", name: "テスト" })
    const res = await executeWithContext((c) =>
      handleResultWith(c, result, (v) => ({ subject: v }))
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ subject: { id: "1", name: "テスト" } })
  })

  it("ok結果を201で返せる", async () => {
    const result = ok({ id: "new" })
    const res = await executeWithContext((c) =>
      handleResultWith(c, result, (v) => ({ created: v }), 201)
    )
    expect(res.status).toBe(201)
  })

  it("successStatusが204の場合は空ボディで返す", async () => {
    const result = ok("ignored")
    const res = await executeWithContext((c) =>
      handleResultWith(c, result, (v) => ({ data: v }), 204)
    )
    expect(res.status).toBe(204)
  })

  it("err結果はtransformせず対応するHTTPステータスで返す", async () => {
    const error: AppError = { code: "UNAUTHORIZED", message: "認証エラー" }
    const result = err(error)
    const res = await executeWithContext((c) =>
      handleResultWith(c, result, (v: any) => ({ data: v }))
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe("UNAUTHORIZED")
  })
})

// === 境界値テスト ===

describe("handleResult 境界値", () => {
  it("ok(null)→ステータス200でnull bodyが返る（204ではない）", async () => {
    const result = ok(null)
    const res = await executeWithContext((c) => handleResult(c, result))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeNull()
  })

  it("ok(0)→ステータス200で0 bodyが返る", async () => {
    const result = ok(0)
    const res = await executeWithContext((c) => handleResult(c, result))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBe(0)
  })

  it('ok("")→ステータス200で空文字bodyが返る', async () => {
    const result = ok("")
    const res = await executeWithContext((c) => handleResult(c, result))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBe("")
  })

  it("ok(false)→ステータス200でfalse bodyが返る", async () => {
    const result = ok(false)
    const res = await executeWithContext((c) => handleResult(c, result))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBe(false)
  })
})
