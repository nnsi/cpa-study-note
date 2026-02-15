/** WAEに書き込む対象のログかどうかを判定 */
export const shouldWriteToWAE = (entry: Record<string, unknown>): boolean =>
  entry.msg === "Response sent" ||
  entry.msg === "Stream complete" ||
  entry.level === "error"

/** ログエントリをWorkers Analytics Engineに書き込む */
export const writeToWAE = (
  logs: AnalyticsEngineDataset,
  entry: Record<string, unknown>
): void => {
  logs.writeDataPoint({
    blobs: [
      String(entry.level ?? "info"),     // blob1: ログレベル
      String(entry.msg ?? ""),           // blob2: メッセージ
      String(entry.requestId ?? ""),     // blob3: リクエストID
      String(entry.method ?? ""),        // blob4: HTTPメソッド
      String(entry.path ?? ""),          // blob5: パス
      String(entry.feature ?? ""),       // blob6: feature名
      String(entry.error ?? ""),         // blob7: エラー内容
    ],
    doubles: [
      Number(entry.status ?? 0),         // double1: HTTPステータス
      Number(entry.duration ?? 0),       // double2: 総リクエスト時間 (ms)
      Number(entry.d1Ms ?? 0),           // double3: D1合計時間 (ms)
      Number(entry.aiMs ?? 0),           // double4: AI合計時間 (ms)
      Number(entry.r2Ms ?? 0),           // double5: R2合計時間 (ms)
      Number(entry.spanCount ?? 0),      // double6: 計測操作数
    ],
    indexes: [
      String(entry.level ?? "info"),     // index1: ログレベル (フィルタ用)
    ],
  })
}
