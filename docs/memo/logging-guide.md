# 構造化ログ適用ガイド

auth featureで実装した構造化ログを、残りのfeatureに適用するための手順書。

## 前提

以下が導入済み:

- `shared/lib/logger.ts` — Logger本体
- `shared/middleware/logger.ts` — リクエストスコープのloggerをcontextにセット
- `shared/types/env.ts` — `Variables.logger` 型定義

全リクエストで `c.get("logger")` が利用可能。

## 適用手順（1 feature あたり）

### Step 1: Route層 — contextからloggerを取得

```typescript
// route.ts のハンドラ内
.post("/some-action", authMiddleware, async (c) => {
  const logger = c.get("logger").child({ feature: "note" })
  const result = await someUseCase({ repo, logger }, input)
  return handleResult(c, result, "data")
})
```

- `child({ feature: "xxx" })` で feature 名をバインドする
- feature 名は **ディレクトリ名と一致** させる（`auth`, `chat`, `note`, `image` 等）
- ハンドラの先頭で取得し、usecaseに渡す

### Step 2: UseCase層 — depsにloggerを追加

```typescript
// usecase.ts
import type { Logger } from "@/shared/lib/logger"

type SomeDeps = {
  repo: SomeRepository
  logger: Logger       // 追加
}

export const someUseCase = async (deps: SomeDeps, input: Input) => {
  const { repo, logger } = deps

  // エラーログ
  logger.error("AI stream failed", { error: err.message, topicId })

  // 警告ログ（処理は続行するがログに残したい場合）
  logger.warn("Fallback to default", { reason: "config missing" })

  // デバッグログ（パフォーマンス計測等）
  logger.debug("Query completed", { duration: t1 - t0, rowCount: results.length })
}
```

### Step 3: 既存の `console.*` を置換

| 変更前 | 変更後 |
|--------|--------|
| `console.error("[AI] Stream error:", error)` | `logger.error("AI stream failed", { error: error.message })` |
| `console.error("[Note] listNotes error:", e)` | `logger.error("Failed to list notes", { error: e.message })` |
| `console.log(\`[chat-perf] Phase1: ${ms}ms\`)` | `logger.debug("Phase1 findSession", { duration: ms })` |

**原則:**
- `console.error` → `logger.error` または `logger.warn`
- `console.log` でパフォーマンス計測 → `logger.debug`
- タグ文字列 (`[AI]`, `[Note]`) → `child({ feature })` で自動付与されるので不要

### Step 4: Provider/外部連携層の対応

provider（Google OAuth等）やAIクライアントなど、usecase外で `console.error` している箇所:

- **`console.error` を削除**し、throwするエラーメッセージに診断情報を含める
- ログ出力はusecase側の catch ブロックで行う

```typescript
// Before (provider内)
console.error("[Google OAuth] Token exchange failed:", res.status)
throw new Error("Authentication failed")

// After (provider内: ログ削除、メッセージ改善)
throw new Error(`Token exchange failed: ${res.status}`)

// After (usecase内: 構造化ログで記録)
} catch (error) {
  logger.error("Token exchange failed", {
    provider: providerName,
    error: error instanceof Error ? error.message : String(error),
  })
  return err(unauthorized("認証コードの交換に失敗しました"))
}
```

### Step 5: テストの更新

usecase の deps に `logger` が必須になるため、テストで noopLogger を渡す:

```typescript
import type { Logger } from "@/shared/lib/logger"

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
}

// テスト内
const result = await someUseCase({ repo, logger: noopLogger }, input)
```

route テストでは `loggerMiddleware()` をアプリに追加:

```typescript
import { loggerMiddleware } from "../../shared/middleware/logger"

app = new Hono<{ Bindings: Env; Variables: Variables }>()
app.use("*", loggerMiddleware())
app.route("/some", someRoutes({ env, db }))
```

## ログレベルの使い分け

| レベル | 用途 | 例 |
|--------|------|-----|
| `error` | 処理が失敗し、ユーザーにエラーが返る | AI API呼び出し失敗、DB エラー |
| `warn` | 処理は続行するが異常な状態 | サンプルデータ作成失敗、フォールバック発動 |
| `info` | 正常な業務イベント | ミドルウェアの Request/Response ログ（自動出力） |
| `debug` | 開発時のみ有用な詳細情報 | パフォーマンス計測、中間状態のダンプ |

## data に含めるべき情報

```typescript
// エラーログ: 何が起きたか再現可能な情報
logger.error("Failed to generate note", {
  error: error.message,    // エラー内容
  topicId,                 // 対象リソース
  model: "gemini-2.5-flash", // 外部サービス情報
})

// パフォーマンスログ: ボトルネック特定に必要な情報
logger.debug("AI stream complete", {
  duration: t5 - t4,       // 処理時間
  ttfb: firstChunkTime - t4, // 初回チャンクまでの時間
  chunks: chunkCount,      // チャンク数
})
```

**含めてはいけないもの:**
- ユーザーのパスワード、トークン、セッション情報
- リクエストボディの全文（大きすぎる、個人情報を含む可能性）
- スタックトレース（ミドルウェアのUnhandled error以外では不要）

## 適用対象一覧

| Feature | console.* 箇所 | 優先度 | 備考 |
|---------|----------------|--------|------|
| `auth` | 0 | - | **適用済み** |
| `chat` | 7 | 高 | パフォーマンス計測 + AIエラー。debug/errorの使い分けが必要 |
| `note` | 5 | 高 | AIエラー + DBエラー |
| `topic-generator` | 1 | 中 | AIストリームエラー |
| `study-plan` | 1 | 中 | AIストリームエラー。`ai-usecase.ts` に console.error あり（usecase.ts ではない） |
| `quick-chat` | 1 | 中 | AIストリームエラー |
| `study-domain` | 1 | 低 | CSVインポートエラー。**route.ts に直接** console.error がある |
| `bookmark` | 0 | - | console.* なし（loggerのdeps追加のみ） |
| `exercise` | 0 | - | console.* なし |
| `image` | 0 | - | console.* なし |
| `learning` | 0 | - | console.* なし |
| `metrics` | 0 | - | console.* なし |
| `subject` | 0 | - | console.* なし |
| `view` | 0 | - | console.* なし |

`console.*` がないfeatureはdeps追加だけで完了（機械的作業）。chat と note が主な作業対象。

## 注意点

### usecase.ts 以外のファイルにも console.* がある

- `study-plan/ai-usecase.ts` — usecase が分割されている。両方の Deps 型に logger を追加する
- `study-domain/route.ts` — route 層に直接 `console.error` がある。route 内で `logger.error` に置換する

### route.test.ts が12件ある

全 feature の route.test.ts に `loggerMiddleware()` を追加する必要がある。auth 以外は未適用。テストアプリの作成部分に1行追加:

```typescript
import { loggerMiddleware } from "../../shared/middleware/logger"

app = new Hono<{ Bindings: Env; Variables: Variables }>()
app.use("*", loggerMiddleware())  // 追加
app.route(...)
```

### noopLogger の共通化

現在は `auth/usecase.test.ts` にインライン定義している。全 feature のテストで同じ定義が必要になるので、テストヘルパーとして共通化を推奨:

```typescript
// test/helpers.ts に追加
import type { Logger } from "@/shared/lib/logger"

export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
}
```
