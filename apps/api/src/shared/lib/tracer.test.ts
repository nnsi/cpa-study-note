import { describe, it, expect } from "vitest"
import { createTracer, noopTracer } from "./tracer"

describe("createTracer", () => {
  it("span()でasync関数の実行時間を計測する", async () => {
    const tracer = createTracer()

    const result = await tracer.span("d1.query", async () => {
      await new Promise((r) => setTimeout(r, 10))
      return "ok"
    })

    expect(result).toBe("ok")
    const summary = tracer.getSummary()
    expect(summary.d1Ms).toBeGreaterThanOrEqual(10)
    expect(summary.spanCount).toBe(1)
  })

  it("span()で例外が発生してもdurationが記録される", async () => {
    const tracer = createTracer()

    await expect(
      tracer.span("d1.failingQuery", async () => {
        await new Promise((r) => setTimeout(r, 5))
        throw new Error("DB error")
      })
    ).rejects.toThrow("DB error")

    const summary = tracer.getSummary()
    expect(summary.d1Ms).toBeGreaterThanOrEqual(5)
    expect(summary.spanCount).toBe(1)
  })

  it("addSpan()で手動のspan記録ができる", () => {
    const tracer = createTracer()

    tracer.addSpan("ai.stream", 1500)
    tracer.addSpan("ai.ttfb", 200)

    const summary = tracer.getSummary()
    expect(summary.aiMs).toBe(1700)
    expect(summary.spanCount).toBe(2)
  })

  it("getSummary()がカテゴリ別に合計を返す", async () => {
    const tracer = createTracer()

    tracer.addSpan("d1.findSession", 10)
    tracer.addSpan("d1.findMessages", 15)
    tracer.addSpan("ai.generateText", 500)
    tracer.addSpan("r2.put", 30)

    const summary = tracer.getSummary()
    expect(summary.d1Ms).toBe(25)
    expect(summary.aiMs).toBe(500)
    expect(summary.r2Ms).toBe(30)
    expect(summary.spanCount).toBe(4)
  })

  it("未分類のspanはどのカテゴリにも加算されない", () => {
    const tracer = createTracer()

    tracer.addSpan("other.operation", 100)

    const summary = tracer.getSummary()
    expect(summary.d1Ms).toBe(0)
    expect(summary.aiMs).toBe(0)
    expect(summary.r2Ms).toBe(0)
    expect(summary.spanCount).toBe(1)
  })

  it("spanがない場合すべて0を返す", () => {
    const tracer = createTracer()
    const summary = tracer.getSummary()

    expect(summary.d1Ms).toBe(0)
    expect(summary.aiMs).toBe(0)
    expect(summary.r2Ms).toBe(0)
    expect(summary.spanCount).toBe(0)
  })
})

describe("noopTracer", () => {
  it("span()が関数をそのまま実行する", async () => {
    const result = await noopTracer.span("d1.query", async () => "ok")
    expect(result).toBe("ok")
  })

  it("getSummary()が常に0を返す", () => {
    noopTracer.addSpan("d1.query", 100)
    const summary = noopTracer.getSummary()
    expect(summary.d1Ms).toBe(0)
    expect(summary.spanCount).toBe(0)
  })
})
