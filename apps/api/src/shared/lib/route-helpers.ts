import type { Context } from "hono"
import type { Result } from "./result"
import { type AppError, errorCodeToStatus } from "./errors"

type ErrorResponse = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

type SuccessStatus = 200 | 201 | 204
type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 500

/**
 * AppErrorをHTTPエラーレスポンスに変換する
 */
export const errorResponse = (c: Context, error: AppError) => {
  const status = errorCodeToStatus[error.code] as ErrorStatus
  return c.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    } satisfies ErrorResponse,
    status
  )
}

/**
 * Result型をHTTPレスポンスに変換する（統合版）
 *
 * @example
 * // そのまま返す
 * return handleResult(c, result)
 *
 * // キーでラップ
 * return handleResult(c, result, "subject")       // → { subject: value }
 *
 * // ステータス指定
 * return handleResult(c, result, 204)
 *
 * // キー + ステータス
 * return handleResult(c, result, "subject", 201)  // → { subject: value } with 201
 */
export function handleResult<T>(
  c: Context,
  result: Result<T, AppError>,
): Response
export function handleResult<T>(
  c: Context,
  result: Result<T, AppError>,
  status: SuccessStatus,
): Response
export function handleResult<T>(
  c: Context,
  result: Result<T, AppError>,
  key: string,
  status?: SuccessStatus,
): Response
export function handleResult<T>(
  c: Context,
  result: Result<T, AppError>,
  keyOrStatus?: string | SuccessStatus,
  status?: SuccessStatus,
): Response {
  if (!result.ok) {
    return errorResponse(c, result.error)
  }

  const key = typeof keyOrStatus === "string" ? keyOrStatus : undefined
  const successStatus = typeof keyOrStatus === "number" ? keyOrStatus : (status ?? 200)

  if (successStatus === 204 || result.value === undefined) {
    return c.body(null, 204)
  }

  const body = key ? { [key]: result.value } : result.value
  return c.json(body, successStatus)
}

/**
 * Result型をバイナリレスポンスに変換する（画像ファイル配信用）
 *
 * @example
 * const result = await getImageFile(deps, userId, imageId)
 * return handleResultImage(c, result, "private, max-age=3600")
 */
export const handleResultImage = <
  T extends { body: ReadableStream | ArrayBuffer | null; mimeType: string },
>(
  c: Context,
  result: Result<T, AppError>,
  cacheControl?: string,
): Response => {
  if (!result.ok) {
    return errorResponse(c, result.error)
  }

  return new Response(result.value.body, {
    headers: {
      "Content-Type": result.value.mimeType,
      ...(cacheControl && { "Cache-Control": cacheControl }),
    },
  })
}
