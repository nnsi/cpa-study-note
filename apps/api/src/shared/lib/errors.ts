// HTTPステータスコードに対応するエラーコード
export type ErrorCode =
  | "NOT_FOUND" // 404
  | "FORBIDDEN" // 403
  | "UNAUTHORIZED" // 401
  | "BAD_REQUEST" // 400
  | "CONFLICT" // 409
  | "PAYLOAD_TOO_LARGE" // 413
  | "INTERNAL_ERROR" // 500

// アプリケーション共通エラー型
export type AppError = {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
}

// エラー生成ヘルパー
export const notFound = (
  message: string,
  details?: Record<string, unknown>
): AppError => ({
  code: "NOT_FOUND",
  message,
  details,
})

export const forbidden = (
  message: string,
  details?: Record<string, unknown>
): AppError => ({
  code: "FORBIDDEN",
  message,
  details,
})

export const badRequest = (
  message: string,
  details?: Record<string, unknown>
): AppError => ({
  code: "BAD_REQUEST",
  message,
  details,
})

export const conflict = (
  message: string,
  details?: Record<string, unknown>
): AppError => ({
  code: "CONFLICT",
  message,
  details,
})

export const unauthorized = (
  message: string,
  details?: Record<string, unknown>
): AppError => ({
  code: "UNAUTHORIZED",
  message,
  details,
})

export const internalError = (
  message: string,
  details?: Record<string, unknown>
): AppError => ({
  code: "INTERNAL_ERROR",
  message,
  details,
})

export const payloadTooLarge = (
  message: string,
  details?: Record<string, unknown>
): AppError => ({
  code: "PAYLOAD_TOO_LARGE",
  message,
  details,
})

// コード → HTTPステータスのマッピング
export const errorCodeToStatus = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
} as const satisfies Record<ErrorCode, number>
