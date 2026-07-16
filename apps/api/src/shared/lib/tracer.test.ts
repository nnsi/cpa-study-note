import { describe, it, expect, vi, afterEach } from "vitest"
import { createTracer, noopTracer } from "./tracer"

describe("createTracer", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("span()でasync関数の実行時間を計測する", async () => {
    // 実時間のsetTimeoutはperformance.now()計測で指定ms未満に発火することがあり
    // flakyになるため、タイマーとperformanceを両方フェイクして決定的に計測する
    vi.useFakeTimers({ toFake: ["setTimeout", "performance"] })
    const tracer = createTracer()

    const promise = tracer.span("d1.query", async () => {
      await new Promise((r) => setTimeout(r, 10))
      return "ok"
    })
    await vi.advanceTimersByTimeAsync(10)

    expect(await promise).toBe("ok")
    const summary = tracer.getSummary()
    expect(summary.d1Ms).toBe(10)
    expect(summary.spanCount).toBe(1)
  })

  it("span()で例外が発生してもdurationが記録される", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "performance"] })
    const tracer = createTracer()

    // advance前にrejectionハンドラを付けて未処理拒否を防ぐ
    const assertion = expect(
      tracer.span("d1.failingQuery", async () => {
        await new Promise((r) => setTimeout(r, 5))
        throw new Error("DB error")
      })
    ).rejects.toThrow("DB error")
    await vi.advanceTimersByTimeAsync(5)
    await assertion

    const summary = tracer.getSummary()
    expect(summary.d1Ms).toBe(5)
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
