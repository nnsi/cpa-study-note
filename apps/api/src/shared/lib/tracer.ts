export type SpanData = {
  name: string
  duration: number
}

export type TracerSummary = {
  d1Ms: number
  aiMs: number
  r2Ms: number
  spanCount: number
}

export type Tracer = {
  /** async関数をラップして自動計測 */
  span: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  /** ストリーミング等で手動記録が必要な場合用 */
  addSpan: (name: string, duration: number) => void
  /** カテゴリ別の合計を返す（d1./ai./r2. プレフィックスで分類） */
  getSummary: () => TracerSummary
}

export const createTracer = (): Tracer => {
  const spans: SpanData[] = []

  return {
    span: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      const start = performance.now()
      try {
        return await fn()
      } finally {
        spans.push({ name, duration: performance.now() - start })
      }
    },

    addSpan: (name: string, duration: number) => {
      spans.push({ name, duration })
    },

    getSummary: () => {
      let d1Ms = 0
      let aiMs = 0
      let r2Ms = 0

      for (const s of spans) {
        if (s.name.startsWith("d1.")) d1Ms += s.duration
        else if (s.name.startsWith("ai.")) aiMs += s.duration
        else if (s.name.startsWith("r2.")) r2Ms += s.duration
      }

      return {
        d1Ms: Math.round(d1Ms),
        aiMs: Math.round(aiMs),
        r2Ms: Math.round(r2Ms),
        spanCount: spans.length,
      }
    },
  }
}

/** テスト用のno-op tracer */
export const noopTracer: Tracer = {
  span: async <T>(_name: string, fn: () => Promise<T>): Promise<T> => fn(),
  addSpan: () => {},
  getSummary: () => ({ d1Ms: 0, aiMs: 0, r2Ms: 0, spanCount: 0 }),
}
