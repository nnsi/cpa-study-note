/**
 * Rate Limiting Types
 *
 * Token Bucket アルゴリズムベースのレート制限
 * Adapter パターンでストレージを抽象化（DO, Redis, Memory）
 */

/** レート制限の設定 */
export type RateLimitConfig = {
  /** ウィンドウあたりの最大リクエスト数 */
  limit: number
  /** ウィンドウサイズ（ミリ秒） */
  windowMs: number
  /** キー生成関数（デフォルト: IP） */
  keyGenerator?: (c: RateLimitContext) => string
  /** レート制限超過時のメッセージ */
  message?: string
  /** スキップ判定（trueでスキップ） */
  skip?: (c: RateLimitContext) => boolean | Promise<boolean>
}

/** レート制限コンテキスト（Honoから渡される情報） */
export type RateLimitContext = {
  ip: string
  path: string
  method: string
  userId?: string
}

/** レート制限チェック結果 */
export type RateLimitResult = {
  /** 許可されたか */
  allowed: boolean
  /** 残りリクエスト数 */
  remaining: number
  /** リセットまでの秒数 */
  resetInSeconds: number
  /** 上限値 */
  limit: number
}

/** レート制限情報（ストレージに保存） */
export type RateLimitInfo = {
  /** トークン数（残りリクエスト数） */
  tokens: number
  /** 最後のリフィル時刻 */
  lastRefillAt: number
}

/**
 * レート制限ストアインターフェース
 *
 * 実装:
 * - MemoryRateLimitStore: 開発・テスト用
 * - DurableObjectRateLimitStore: 本番用（Cloudflare DO）
 * - RedisRateLimitStore: 将来の拡張用
 */
export type RateLimitStore = {
  /**
   * レート制限をチェックし、許可されればトークンを消費
   * @param key 識別キー（例: "ip:192.168.1.1" または "user:abc123"）
   * @param config レート制限設定
   * @returns チェック結果
   */
  check: (key: string, config: RateLimitConfig) => Promise<RateLimitResult>

  /**
   * 現在の状態を取得（トークン消費なし）
   */
  get: (key: string, config: RateLimitConfig) => Promise<RateLimitResult>

  /**
   * リセット（テスト用）
   */
  reset?: (key: string) => Promise<void>
}

/** ストアの種類 */
export type RateLimitStoreType = "memory" | "durable-object"

/** ストア作成オプション */
export type CreateRateLimitStoreOptions =
  | { type: "memory" }
  | { type: "durable-object"; namespace: DurableObjectNamespace }
