import { describe, it, expect } from "vitest"
import {
  apiErrorSchema,
  successResponseSchema,
  messageResponseSchema,
} from "./error"

describe("apiErrorSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = apiErrorSchema.safeParse({
      error: {
        code: "NOT_FOUND",
        message: "リソースが見つかりません",
      },
    })
    expect(result.success).toBe(true)
  })

  it("detailsを含むデータをパースできる", () => {
    const result = apiErrorSchema.safeParse({
      error: {
        code: "BAD_REQUEST",
        message: "バリデーションエラー",
        details: { field: "name", reason: "required" },
      },
    })
    expect(result.success).toBe(true)
  })

  it("detailsが省略でも有効", () => {
    const result = apiErrorSchema.safeParse({
      error: {
        code: "INTERNAL_ERROR",
        message: "サーバーエラー",
      },
    })
    expect(result.success).toBe(true)
  })

  it("errorオブジェクト欠落でエラー", () => {
    const result = apiErrorSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("code欠落でエラー", () => {
    const result = apiErrorSchema.safeParse({
      error: { message: "エラー" },
    })
    expect(result.success).toBe(false)
  })

  it("message欠落でエラー", () => {
    const result = apiErrorSchema.safeParse({
      error: { code: "NOT_FOUND" },
    })
    expect(result.success).toBe(false)
  })
})

describe("successResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = successResponseSchema.safeParse({ success: true })
    expect(result.success).toBe(true)
  })

  it("falseもパースできる", () => {
    const result = successResponseSchema.safeParse({ success: false })
    expect(result.success).toBe(true)
  })

  it("success欠落でエラー", () => {
    const result = successResponseSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("successが文字列でエラー", () => {
    const result = successResponseSchema.safeParse({ success: "true" })
    expect(result.success).toBe(false)
  })
})

describe("messageResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = messageResponseSchema.safeParse({ message: "完了しました" })
    expect(result.success).toBe(true)
  })

  it("message欠落でエラー", () => {
    const result = messageResponseSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
