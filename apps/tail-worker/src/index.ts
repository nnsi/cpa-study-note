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
}

const parseLogMessage = (message: string): LogEntry | null => {
  try {
    return JSON.parse(message) as LogEntry
  } catch {
    return null
  }
}

export default {
  async tail(events: TraceItem[], env: Env): Promise<void> {
    for (const event of events) {
      for (const log of event.logs) {
        const entry = parseLogMessage(
          log.message.length === 1 ? String(log.message[0]) : JSON.stringify(log.message)
        )
        if (!entry) continue

        env.LOGS.writeDataPoint({
          blobs: [
            entry.level ?? "info",
            entry.msg ?? "",
            entry.requestId ?? "",
            entry.method ?? "",
            entry.path ?? "",
            entry.feature ?? "",
            entry.error ?? "",
          ],
          doubles: [
            entry.status ?? 0,
            entry.duration ?? 0,
          ],
          indexes: [
            entry.level ?? "info",
          ],
        })
      }
    }
  },
}
