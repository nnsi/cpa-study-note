interface Env {
  LOGS: AnalyticsEngineDataset
}

type LogEntry = {
  level?: string
  msg?: string
  requestId?: string
  method?: string
  path?: string
  feature?: string
  status?: number
  duration?: number
  error?: string
  // APM performance fields
  d1Ms?: number
  aiMs?: number
  r2Ms?: number
  spanCount?: number
}

const parseLogMessage = (message: string): LogEntry | null => {
  try {
    return JSON.parse(message) as LogEntry
  } catch {
    return null
  }
}

/** WAEに書き込む対象のログかどうかを判定 */
const shouldWrite = (entry: LogEntry): boolean =>
  entry.msg === "Response sent" ||
  entry.msg === "Stream complete" ||
  entry.level === "error"

export default {
  async tail(events: TraceItem[], env: Env): Promise<void> {
    for (const event of events) {
      for (const log of event.logs) {
        const entry = parseLogMessage(
          log.message.length === 1 ? String(log.message[0]) : JSON.stringify(log.message)
        )
        if (!entry) continue
        if (!shouldWrite(entry)) continue

        env.LOGS.writeDataPoint({
          blobs: [
            entry.level ?? "info",     // blob1: ログレベル
            entry.msg ?? "",           // blob2: メッセージ
            entry.requestId ?? "",     // blob3: リクエストID
            entry.method ?? "",        // blob4: HTTPメソッド
            entry.path ?? "",          // blob5: パス
            entry.feature ?? "",       // blob6: feature名
            entry.error ?? "",         // blob7: エラー内容
          ],
          doubles: [
            entry.status ?? 0,         // double1: HTTPステータス
            entry.duration ?? 0,       // double2: 総リクエスト時間 (ms)
            entry.d1Ms ?? 0,           // double3: D1合計時間 (ms)
            entry.aiMs ?? 0,           // double4: AI合計時間 (ms)
            entry.r2Ms ?? 0,           // double5: R2合計時間 (ms)
            entry.spanCount ?? 0,      // double6: 計測操作数
          ],
          indexes: [
            entry.level ?? "info",     // index1: ログレベル (フィルタ用)
          ],
        })
      }
    }
  },
}
