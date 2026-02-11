import { describe, it, expect } from "vitest"
import {
  ok,
  err,
  isOk,
  isErr,
  mapResult,
  flatMapResult,
  unwrapOr,
  match,
} from "./result"

describe("ok", () => {
  it("ok結果を生成する", () => {
    const result = ok(42)
    expect(result).toEqual({ ok: true, value: 42 })
  })

  it("nullをラップできる", () => {
    const result = ok(null)
    expect(result).toEqual({ ok: true, value: null })
  })
})

describe("err", () => {
  it("err結果を生成する", () => {
    const result = err("エラー")
    expect(result).toEqual({ ok: false, error: "エラー" })
  })

  it("オブジェクトをエラーとしてラップできる", () => {
    const error = { code: "NOT_FOUND", message: "見つかりません" }
    const result = err(error)
    expect(result).toEqual({ ok: false, error })
  })
})

describe("isOk", () => {
  it("ok結果に対してtrueを返す", () => {
    expect(isOk(ok(1))).toBe(true)
  })

  it("err結果に対してfalseを返す", () => {
    expect(isOk(err("error"))).toBe(false)
  })
})

describe("isErr", () => {
  it("err結果に対してtrueを返す", () => {
    expect(isErr(err("error"))).toBe(true)
  })

  it("ok結果に対してfalseを返す", () => {
    expect(isErr(ok(1))).toBe(false)
  })
})

describe("mapResult", () => {
  it("ok結果の値を変換する", () => {
    const result = mapResult(ok(5), (v) => v * 2)
    expect(result).toEqual(ok(10))
  })

  it("err結果はそのまま返す", () => {
    const original = err("error")
    const result = mapResult(original, (v: number) => v * 2)
    expect(result).toEqual(original)
  })
})

describe("flatMapResult", () => {
  it("ok結果に対して関数を適用する", () => {
    const result = flatMapResult(ok(5), (v) => ok(v * 2))
    expect(result).toEqual(ok(10))
  })

  it("ok結果に対してerrを返す関数を適用できる", () => {
    const result = flatMapResult(ok(5), () => err("failed"))
    expect(result).toEqual(err("failed"))
  })

  it("err結果はそのまま返す", () => {
    const original = err("error")
    const result = flatMapResult(original, (v: number) => ok(v * 2))
    expect(result).toEqual(original)
  })
})

describe("unwrapOr", () => {
  it("ok結果の値を返す", () => {
    expect(unwrapOr(ok(42), 0)).toBe(42)
  })

  it("err結果の場合デフォルト値を返す", () => {
    expect(unwrapOr(err("error"), 0)).toBe(0)
  })
})

describe("match", () => {
  it("ok結果に対してokハンドラを実行する", () => {
    const result = match(ok(5), {
      ok: (v) => `値: ${v}`,
      err: (e) => `エラー: ${e}`,
    })
    expect(result).toBe("値: 5")
  })

  it("err結果に対してerrハンドラを実行する", () => {
    const result = match(err("failed"), {
      ok: (v) => `値: ${v}`,
      err: (e) => `エラー: ${e}`,
    })
    expect(result).toBe("エラー: failed")
  })

  it("ハンドラの返り値の型が統一される", () => {
    const result = match(ok(10), {
      ok: (v) => v > 5,
      err: () => false,
    })
    expect(result).toBe(true)
  })
})

// === 境界値テスト ===

describe("unwrapOr 境界値", () => {
  it("ok(null)→nullが返る（falsy valueだがdefaultValueではなく値が返る）", () => {
    expect(unwrapOr(ok(null), "default")).toBeNull()
  })

  it("ok(0)→0が返る（falsy valueだがdefaultValueではなく値が返る）", () => {
    expect(unwrapOr(ok(0), 999)).toBe(0)
  })

  it("ok(false)→falseが返る（falsy valueだがdefaultValueではなく値が返る）", () => {
    expect(unwrapOr(ok(false), true)).toBe(false)
  })

  it('ok("")→空文字が返る（falsy valueだがdefaultValueではなく値が返る）', () => {
    expect(unwrapOr(ok(""), "default")).toBe("")
  })
})

describe("match 境界値", () => {
  it("ok(undefined)→okハンドラがundefinedで呼ばれる", () => {
    const result = match(ok(undefined), {
      ok: (v) => v === undefined ? "undefined received" : "other",
      err: () => "error",
    })
    expect(result).toBe("undefined received")
  })

  it("ok(null)→okハンドラがnullで呼ばれる", () => {
    const result = match(ok(null), {
      ok: (v) => v === null ? "null received" : "other",
      err: () => "error",
    })
    expect(result).toBe("null received")
  })
})

describe("mapResult 境界値", () => {
  it("3段チェーンで正しく変換される", () => {
    const result = mapResult(
      mapResult(
        mapResult(ok(1), (x) => x + 1),
        (x) => x * 2
      ),
      (x) => String(x)
    )
    expect(result).toEqual(ok("4"))
  })
})

describe("flatMapResult 境界値", () => {
  it("3段チェーン: ok→ok→ok", () => {
    const result = flatMapResult(
      flatMapResult(
        ok(1),
        (x) => ok(x + 1)
      ),
      (x) => ok(x * 2)
    )
    expect(result).toEqual(ok(4))
  })

  it("3段チェーン: ok→ok→err", () => {
    const result = flatMapResult(
      flatMapResult(
        ok(1),
        (x) => ok(x + 1)
      ),
      () => err("failed at step 3")
    )
    expect(result).toEqual(err("failed at step 3"))
  })
})
