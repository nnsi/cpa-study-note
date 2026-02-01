import type { MiddlewareHandler } from "hono"

/**
 * ロガーミドルウェア
 * - リクエスト/レスポンスのログ出力
 * - エラー時はスタックトレースを含む詳細出力
 * - ログはconsoleに出力され、wranglerのログファイルに記録される
 */
export const logger = (): MiddlewareHandler => {
  return async (c, next) => {
    const start = Date.now()
    const method = c.req.method
    const path = c.req.path

    // リクエストログ
    console.log(`[${new Date().toISOString()}] --> ${method} ${path}`)

    try {
      await next()
    } catch (error) {
      // エラーログ（詳細）
      const duration = Date.now() - start
      console.error(`[${new Date().toISOString()}] <-- ${method} ${path} ERROR ${duration}ms`)
      console.error("[ERROR DETAILS]")

      if (error instanceof Error) {
        console.error(`  Name: ${error.name}`)
        console.error(`  Message: ${error.message}`)
        if (error.stack) {
          console.error(`  Stack:`)
          error.stack.split("\n").forEach((line) => {
            console.error(`    ${line}`)
          })
        }
        if (error.cause) {
          console.error(`  Cause:`, error.cause)
        }
      } else {
        console.error(`  Error:`, error)
      }

      throw error
    }

    // レスポンスログ
    const duration = Date.now() - start
    const status = c.res.status
    const logLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "log"
    console[logLevel](
      `[${new Date().toISOString()}] <-- ${method} ${path} ${status} ${duration}ms`
    )
  }
}
