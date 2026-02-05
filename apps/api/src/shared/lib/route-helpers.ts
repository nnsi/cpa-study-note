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
type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 500

/**
 * AppErrorをHTTPエラーレスポンスに変換する
 *
 * @example
 * const result = await getSubject(deps, userId, id)
 * if (!result.ok) return errorResponse(c, result.error)
 * return c.json({ subject: result.value })
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
 * Result型をHTTPレスポンスに変換する
 *
 * @example
 * // 基本的な使用
 * const result = await deleteSubject(deps, userId, id)
 * return handleResult(c, result)
 *
 * @example
 * // 作成時（201）
 * const result = await createSubject(deps, userId, input)
 * return handleResult(c, result, 201)
 */
export const handleResult = <T>(
  c: Context,
  result: Result<T, AppError>,
  successStatus: SuccessStatus = 200
): Response => {
  if (result.ok) {
    if (successStatus === 204 || result.value === undefined) {
      return c.body(null, 204)
    }
    return c.json(result.value, successStatus)
  }

  const status = errorCodeToStatus[result.error.code] as ErrorStatus
  const errorResponse: ErrorResponse = {
    error: {
      code: result.error.code,
      message: result.error.message,
      ...(result.error.details && { details: result.error.details }),
    },
  }

  return c.json(errorResponse, status)
}

/**
 * Result型をHTTPレスポンスに変換する（成功時のレスポンス形式をカスタマイズ）
 *
 * @example
 * const result = await getSubject(deps, userId, id)
 * return handleResultWith(c, result, (subject) => ({ subject }))
 */
export const handleResultWith = <T, R>(
  c: Context,
  result: Result<T, AppError>,
  transform: (value: T) => R,
  successStatus: SuccessStatus = 200
): Response => {
  if (result.ok) {
    if (successStatus === 204) {
      return c.body(null, 204)
    }
    return c.json(transform(result.value), successStatus)
  }

  const status = errorCodeToStatus[result.error.code] as ErrorStatus
  const errorResponse: ErrorResponse = {
    error: {
      code: result.error.code,
      message: result.error.message,
      ...(result.error.details && { details: result.error.details }),
    },
  }

  return c.json(errorResponse, status)
}
