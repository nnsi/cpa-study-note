import { describe, it, expect } from "vitest"
import {
  notFound,
  forbidden,
  badRequest,
  conflict,
  unauthorized,
  internalError,
  payloadTooLarge,
  errorCodeToStatus,
} from "./errors"
import type { AppError, ErrorCode } from "./errors"

describe("エラー生成ヘルパー", () => {
  const testCases: {
    name: string
    fn: (msg: string, details?: Record<string, unknown>) => AppError
    code: ErrorCode
  }[] = [
    { name: "notFound", fn: notFound, code: "NOT_FOUND" },
    { name: "forbidden", fn: forbidden, code: "FORBIDDEN" },
    { name: "badRequest", fn: badRequest, code: "BAD_REQUEST" },
    { name: "conflict", fn: conflict, code: "CONFLICT" },
    { name: "unauthorized", fn: unauthorized, code: "UNAUTHORIZED" },
    { name: "internalError", fn: internalError, code: "INTERNAL_ERROR" },
    { name: "payloadTooLarge", fn: payloadTooLarge, code: "PAYLOAD_TOO_LARGE" },
  ]

  for (const { name, fn, code } of testCases) {
    describe(name, () => {
      it("正しいcodeとmessageを持つAppErrorを生成する", () => {
        const error = fn("テストメッセージ")
        expect(error.code).toBe(code)
        expect(error.message).toBe("テストメッセージ")
        expect(error.details).toBeUndefined()
      })

      it("detailsを含むAppErrorを生成できる", () => {
        const details = { field: "name", reason: "required" }
        const error = fn("エラー", details)
        expect(error.code).toBe(code)
        expect(error.details).toEqual(details)
      })
    })
  }
})

describe("errorCodeToStatus", () => {
  it("NOT_FOUNDは404", () => {
    expect(errorCodeToStatus.NOT_FOUND).toBe(404)
  })

  it("FORBIDDENは403", () => {
    expect(errorCodeToStatus.FORBIDDEN).toBe(403)
  })

  it("UNAUTHORIZEDは401", () => {
    expect(errorCodeToStatus.UNAUTHORIZED).toBe(401)
  })

  it("BAD_REQUESTは400", () => {
    expect(errorCodeToStatus.BAD_REQUEST).toBe(400)
  })

  it("CONFLICTは409", () => {
    expect(errorCodeToStatus.CONFLICT).toBe(409)
  })

  it("PAYLOAD_TOO_LARGEは413", () => {
    expect(errorCodeToStatus.PAYLOAD_TOO_LARGE).toBe(413)
  })

  it("INTERNAL_ERRORは500", () => {
    expect(errorCodeToStatus.INTERNAL_ERROR).toBe(500)
  })

  it("全ErrorCodeがマッピングされている", () => {
    const codes: ErrorCode[] = [
      "NOT_FOUND",
      "FORBIDDEN",
      "UNAUTHORIZED",
      "BAD_REQUEST",
      "CONFLICT",
      "PAYLOAD_TOO_LARGE",
      "INTERNAL_ERROR",
    ]
    for (const code of codes) {
      expect(errorCodeToStatus[code]).toBeDefined()
      expect(typeof errorCodeToStatus[code]).toBe("number")
    }
  })
})

// === 境界値テスト ===

describe("エラー生成ヘルパー 境界値", () => {
  it("空文字メッセージでAppErrorが作れる", () => {
    const error = notFound("")
    expect(error.code).toBe("NOT_FOUND")
    expect(error.message).toBe("")
  })

  it("特殊文字メッセージが正しく格納される", () => {
    const msg = '改行\n含む"引用符"付き\\バックスラッシュ'
    const error = notFound(msg)
    expect(error.code).toBe("NOT_FOUND")
    expect(error.message).toBe(msg)
  })

  it("detailsにundefined値を含むオブジェクトが正しく格納される", () => {
    const error = notFound("msg", { field: undefined })
    expect(error.code).toBe("NOT_FOUND")
    expect(error.details).toEqual({ field: undefined })
  })
})
