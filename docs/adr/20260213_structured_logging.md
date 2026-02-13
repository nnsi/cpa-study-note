# ADR: 構造化ログの導入

**日付**: 2026-02-13
**ステータス**: 承認済み（auth featureで実装完了、他featureは段階的に適用）

## コンテキスト

API全体のログ実装に以下の課題があった:

1. **本番でログが出ない**: loggerMiddlewareが `ENVIRONMENT === "local"` のみ有効で、staging/production のリクエストログが取れない
2. **構造化されていない**: `console.log` で人間向けの文字列結合。機械的な解析・フィルタリングが困難
3. **タグが不統一**: `[chat-perf]`, `[Google OAuth]`, `[AI]`, `[Auth]`, `[Note]` 等、書式がバラバラ
4. **ログレベルの基準が曖昧**: `console.log` と `console.error` の使い分けが場所により異なる
5. **リクエストIDがない**: 1リクエスト内の複数ログを紐づける手段がない

### 変更前の状態

```typescript
// ミドルウェア（local環境のみ）
console.log(`[${new Date().toISOString()}] --> ${method} ${path}`)
console[logLevel](`[${new Date().toISOString()}] <-- ${method} ${path} ${status} ${duration}ms`)

// 各feature（タグ形式がバラバラ）
console.error("[Google OAuth] Token exchange failed:", res.status)
console.error("[AI] Stream error:", error)
console.log(`[chat-perf] Phase1 findSession: ${(t1 - t0).toFixed(0)}ms`)
console.error("Failed to create sample data for new user:", error)
```

## 決定

### 1. Logger本体 (`shared/lib/logger.ts`)

JSON構造化出力を行うLoggerを新設。

```typescript
export type Logger = {
  debug(msg: string, data?: Record<string, unknown>): void
  info(msg: string, data?: Record<string, unknown>): void
  warn(msg: string, data?: Record<string, unknown>): void
  error(msg: string, data?: Record<string, unknown>): void
  child(bindings: Record<string, unknown>): Logger
}
```

- `child()` でコンテキスト（feature名、userId等）をバインドしたサブロガーを生成
- 出力は常にJSON（`console.log(JSON.stringify(entry))`）
- `console.log` / `console.warn` / `console.error` をレベルに応じて使い分け

### 2. ミドルウェア (`shared/middleware/logger.ts`)

- **全環境で有効**（localだけでなくstaging/productionでも動作）
- リクエストごとに `requestId`（UUID先頭8文字）を生成し全ログに付与
- `c.set("logger", logger)` でHonoのcontextに格納

### 3. Feature側でのログ利用パターン

```typescript
// Route層: contextからloggerを取得し、featureタグを付けてusecase に渡す
const logger = c.get("logger").child({ feature: "auth" })
const result = await handleOAuthCallback({ repo, providers, db, logger }, ...)

// UseCase層: depsからloggerを受け取り使用
const { logger } = deps
logger.error("Token exchange failed", { provider: "google", error: err.message })
```

### 4. Provider層のログ方針

OAuthプロバイダー等の外部連携層は `console.error` を使わず、エラー情報をthrowメッセージに含める。ログ出力はUseCase層が担当する。

```typescript
// Before: provider内でログ出力 + 汎用メッセージでthrow
console.error(`[Google OAuth] Token exchange failed: ${res.status}`)
throw new Error("Authentication failed")

// After: 詳細メッセージでthrow（UseCase側がlogger.errorで記録）
throw new Error(`Token exchange failed: ${res.status}`)
```

### 5. Honoビルトイン `logger()` は使わない

Honoの `hono/logger` は `PrintFunc` で出力先をカスタムできるが、フォーマットが文字列固定でJSON出力やrequestIdの付与ができない。カスタムミドルウェアで対応する。

## 出力フォーマット

```json
{"level":"info","msg":"Request received","requestId":"ca77e644","method":"GET","path":"/api/auth/me","timestamp":"2026-02-13T00:30:33.846Z"}
{"level":"error","msg":"Token exchange failed","requestId":"abc12345","method":"GET","path":"/api/auth/google/callback","feature":"auth","provider":"google","error":"Token exchange failed: 401","timestamp":"2026-02-13T00:30:34.100Z"}
{"level":"info","msg":"Response sent","requestId":"ca77e644","method":"GET","path":"/api/auth/me","status":200,"duration":12,"timestamp":"2026-02-13T00:30:33.858Z"}
```

## 影響範囲

| 対象 | 変更内容 |
|------|---------|
| `shared/lib/logger.ts` | 新規作成 |
| `shared/middleware/logger.ts` | 全面書き換え（JSON出力、全環境有効、requestId生成） |
| `shared/types/env.ts` | `Variables` に `logger: Logger` 追加 |
| `index.ts` | `loggerMiddleware()` を条件なし適用、`onError` を簡素化 |
| `auth/route.ts` | `c.get("logger").child()` → usecase に渡す |
| `auth/usecase.ts` | deps に `logger` 追加、`console.error` を構造化ログに置換 |
| `auth/providers/google.ts` | `console.error` 削除、throw メッセージに情報を残す |
| テストファイル3件 | loggerMiddleware / noopLogger 追加 |

## 今後の作業

- 残り13 featureへの段階的適用（実装指針: `docs/memo/logging-guide.md`）
- ログレベルの環境別制御（本番は `info` 以上のみ等）
- Tail Worker + Workers Analytics Engine によるログ収集・可視化
