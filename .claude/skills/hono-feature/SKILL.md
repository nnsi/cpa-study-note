---
name: hono-feature
description: Hono APIのFeatureモジュールをクリーンアーキテクチャで作成する
---

# Hono Feature モジュール作成

バックエンドのFeatureモジュールをクリーンアーキテクチャ + Hono RPC対応で作成する。

## 重要: 実装後の検証

**Feature実装後は必ず以下を確認すること:**

1. **curlでエンドポイントを叩いて想定値が取得できるか確認**
2. **エラーケースでも適切なレスポンスが返るか確認**
3. **Playwright MCPでフロントエンドとの結合を確認**

詳細は `/test-api` スキルを参照。

## ディレクトリ構造

```
apps/api/src/features/{feature-name}/
├── index.ts           # DI実行、Route返却、型エクスポート
├── domain.ts          # 型定義・ドメインロジック
├── usecase.ts         # ビジネスロジック（純粋関数）
├── repository.ts      # DB操作（Drizzle）
├── service.ts         # 外部サービス呼び出し（任意）
└── route.ts           # Honoルート定義（メソッドチェーン）
```

## 設計原則

1. **依存方向**: 外側 → 内側（Route → UseCase → Domain）
2. **純粋関数**: UseCaseは副作用なし、依存は引数で注入
3. **Result型**: エラーは `Result<T, E>` で表現
4. **Hono RPC**: メソッドチェーンで型推論、型エクスポート
5. **Feature単位でDI**: index.tsでAdapter/Repository注入

## 一貫性ルール（必須）

新規Feature作成時は以下のパターンに従うこと。既存Featureと異なる実装は禁止。

### エラーハンドリング
```typescript
// ✅ 正しい: handleResult でそのまま返す（値をそのままJSON化）
return handleResult(c, result)

// ✅ 正しい: handleResult でキー付きレスポンス（{ items: data }）
return handleResult(c, result, "items")

// ✅ 正しい: handleResult でステータス指定（201 Created）
return handleResult(c, result, "subject", 201)

// ✅ 正しい: void結果は自動的に 204 No Content
return handleResult(c, result)  // result.value === undefined → 204

// ✅ 正しい: 直接エラー生成する場合も err() + handleResult
if (body.byteLength > MAX_SIZE) {
  return handleResult(c, err(payloadTooLarge("ファイルサイズが大きすぎます")))
}

// ❌ 禁止: errorResponse を直接使用
if (!result.ok) return errorResponse(c, result.error)

// ❌ 禁止: c.json で直接エラーを返す
return c.json({ error: "Not found" }, 404)

// ❌ 禁止: if (!result.ok) で分岐してから c.json で返す
if (!result.ok) return handleResult(c, result)
return c.json({ item: result.value }, 200)

// ❌ 廃止: handleResultWith（handleResult に統合済み）
```

### Deps型定義
```typescript
// ✅ 正しい: XxxDeps 形式、db のみ含む
type BookmarkDeps = {
  db: Db
}

// ✅ 正しい: env が必要な場合のみ含める（AI機能等）
type ChatDeps = {
  env: Env  // AI_PROVIDER, OPENROUTER_API_KEY を使用
  db: Db
}

// ❌ 禁止: env を使わないのに含める
type SubjectDeps = {
  env: Env  // 使っていない
  db: Db
}
```

### DIパターン（route.ts）
```typescript
// ✅ 正しい: deps オブジェクトを作成、logger は c.get("logger").child() で取得
export const bookmarkRoutes = ({ db }: BookmarkDeps) => {
  const repo = createBookmarkRepository(db)

  return new Hono()
    .get("/", authMiddleware, async (c) => {
      const logger = c.get("logger").child({ feature: "bookmark" })
      const result = await getBookmarks({ repo, logger }, userId)
      // ...
    })
}

// ❌ 禁止: logger なしで渡す
const result = await getBookmarks({ repo }, userId)

// ❌ 禁止: インラインで渡す
const result = await getBookmarks({ repo: createRepo(db) }, userId)
```

### Indexシグネチャ
```typescript
// ✅ 正しい: env を使わなくても _env として受け取る（インターフェース統一）
export const createBookmarkFeature = (_env: Env, db: Db) => {
  return bookmarkRoutes({ db })
}

// ❌ 禁止: env を省略
export const createBookmarkFeature = (db: Db) => {
  return bookmarkRoutes({ db })
}
```

### Zodスキーマ
```typescript
// ✅ 正しい: shared から import
import { createBookmarkRequestSchema } from "@cpa-study/shared/schemas"

// ❌ 禁止: ローカルで定義
const createBookmarkRequestSchema = z.object({ ... })
```

### Response型
```typescript
// ✅ 正しい: shared から import（コンパイル時に型安全性を担保）
import type { BookmarkResponse, BookmarkListResponse } from "@cpa-study/shared/schemas"

export const getBookmarks = async (deps, userId): Promise<Result<BookmarkListResponse, AppError>> => {
  // ...
}

// ❌ 禁止: ローカルで定義（野良Response型）
type BookmarkResponse = {
  id: string
  // ...
}
```

**理由:** Response型をsharedで一元管理することで、バックエンドのレスポンス形式が変わった場合にフロントエンドでもコンパイルエラーが発生し、型の不整合を防げる。

### レスポンス形式
```typescript
// ✅ 正しい: POST/PUT は詳細データを返す
return c.json({ bookmark: result.value }, 201)

// ❌ 禁止: メッセージだけ返す
return c.json({ message: "Bookmark added" }, 201)
```

### UseCase の Deps型
```typescript
// ✅ 正しい: XxxDeps 形式でエクスポート、logger を含める
export type BookmarkDeps = {
  repo: BookmarkRepository
  logger: Logger
}

// ❌ 禁止: 異なる命名
export type BookmarkUseCaseDeps = { ... }
export type Deps = { ... }

// ❌ 禁止: logger を省略
export type BookmarkDeps = {
  repo: BookmarkRepository
}
```

## テンプレート

### domain.ts
```typescript
// 型定義（外部依存なし）
export type {FeatureName} = {
  id: string
  // ...
}

export type {FeatureName}Error =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DB_ERROR"
```

### usecase.ts
```typescript
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, internalError, type AppError } from "@/shared/lib/errors"
import type { Logger } from "@/shared/lib/logger"
import type { {FeatureName}Repository } from "./repository"

// Deps型: XxxDeps 形式で命名し、エクスポート。logger は必須。
export type {FeatureName}Deps = {
  repo: {FeatureName}Repository
  logger: Logger
}

// 全ての関数は Result<T, AppError> を返す
export const get{FeatureName} = async (
  deps: {FeatureName}Deps,
  userId: string,
  id: string
): Promise<Result<{FeatureName}Response, AppError>> => {
  try {
    const item = await deps.repo.findById(id, userId)
    if (!item) {
      return err(notFound("{featureName}が見つかりません"))
    }
    return ok(formatResponse(item))
  } catch (e) {
    deps.logger.error("Failed to get {featureName}", {
      error: e instanceof Error ? e.message : String(e),
      id,
    })
    return err(internalError("{featureName}の取得に失敗しました"))
  }
}

export const list{FeatureName}s = async (
  deps: {FeatureName}Deps,
  userId: string
): Promise<Result<{FeatureName}Response[], AppError>> => {
  try {
    const items = await deps.repo.findByUser(userId)
    return ok(items.map(formatResponse))
  } catch (e) {
    deps.logger.error("Failed to list {featureName}s", {
      error: e instanceof Error ? e.message : String(e),
    })
    return err(internalError("{featureName}一覧の取得に失敗しました"))
  }
}

export const create{FeatureName} = async (
  deps: {FeatureName}Deps,
  userId: string,
  input: Create{FeatureName}Input
): Promise<Result<{FeatureName}Response, AppError>> => {
  try {
    const item = await deps.repo.create({ ...input, userId })
    return ok(formatResponse(item))
  } catch (e) {
    deps.logger.error("Failed to create {featureName}", {
      error: e instanceof Error ? e.message : String(e),
    })
    return err(internalError("{featureName}の作成に失敗しました"))
  }
}

// レスポンス変換（Date → ISO文字列など）
const formatResponse = (item: {FeatureName}): {FeatureName}Response => ({
  ...item,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
})
```

### repository.ts
```typescript
import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { {tableName} } from "@cpa-study/db/schema"

export const createRepository = (db: DrizzleD1Database) => ({
  findById: async (id: string) => {
    return db.select().from({tableName}).where(eq({tableName}.id, id)).get()
  },

  create: async (data: Create{FeatureName}Input) => {
    return db.insert({tableName}).values(data).returning().get()
  },
})

export type {FeatureName}Repository = ReturnType<typeof createRepository>
```

### route.ts（Hono RPC対応）
```typescript
import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { create{FeatureName}RequestSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { handleResult } from "@/shared/lib/route-helpers"
import { create{FeatureName}Repository } from "./repository"
import { get{FeatureName}, create{FeatureName} } from "./usecase"

// Deps型: db のみ（env は使わないなら含めない）
type {FeatureName}Deps = {
  db: Db
}

export const {featureName}Routes = ({ db }: {FeatureName}Deps) => {
  const repo = create{FeatureName}Repository(db)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // GET: handleResult でキー付きレスポンス
    .get("/:id", authMiddleware, async (c) => {
      const id = c.req.param("id")
      const user = c.get("user")
      const logger = c.get("logger").child({ feature: "{featureName}" })
      const result = await get{FeatureName}({ repo, logger }, user.id, id)
      return handleResult(c, result, "{featureName}")
    })

    // POST: handleResult でキー+ステータス指定
    .post(
      "/",
      authMiddleware,
      zValidator("json", create{FeatureName}RequestSchema),
      async (c) => {
        const user = c.get("user")
        const input = c.req.valid("json")
        const logger = c.get("logger").child({ feature: "{featureName}" })
        const result = await create{FeatureName}({ repo, logger }, user.id, input)
        return handleResult(c, result, "{featureName}", 201)
      }
    )

  return app
}
```

### index.ts（DI + 型エクスポート）
```typescript
import type { Db } from "@cpa-study/db"
import type { Env } from "@/shared/types/env"
import { {featureName}Routes } from "./route"

// シグネチャ: (_env: Env, db: Db) 形式で統一
// env を使わない場合も _env として受け取る（インターフェース統一）
export const create{FeatureName}Feature = (_env: Env, db: Db) => {
  return {featureName}Routes({ db })
}

// Hono RPC用の型エクスポート
export type {FeatureName}Routes = ReturnType<typeof create{FeatureName}Feature>
```

## AI機能を含むFeatureの場合

### route.ts（ストリーミング対応）
```typescript
import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { streamToSSE, type AIAdapter } from "@/shared/lib/ai"
import { sendMessage } from "./usecase"

type Deps = {
  repository: ChatRepository
  aiAdapter: AIAdapter
}

export const chatRoutes = (deps: Deps) =>
  new Hono()
    .post(
      "/sessions/:id/messages/stream",
      zValidator("json", sendMessageRequestSchema),
      async (c) => {
        const sessionId = c.req.param("id")
        const input = c.req.valid("json")

        const stream = await sendMessage(deps, { sessionId, ...input })

        // SSE変換（Adapter層が統一済み）
        return streamToSSE(c, stream)
      }
    )
```

### index.ts（AI Adapter注入）
```typescript
import { createRepository } from "./repository"
import { createAIAdapter } from "@/shared/lib/ai"
import { chatRoutes } from "./route"

export const createChatFeature = (env: Env) => {
  const deps = {
    repository: createRepository(env.DB),
    aiAdapter: createAIAdapter({
      provider: env.AI_PROVIDER,  // "mock" | "vercel-ai"
      apiKey: env.OPENROUTER_API_KEY,
    }),
  }
  return chatRoutes(deps)
}

export type ChatRoutes = ReturnType<typeof createChatFeature>
```

## appへの登録

```typescript
// apps/api/src/index.ts
import { Hono } from "hono"
import { create{FeatureName}Feature } from "./features/{feature-name}"

// env と db を受け取り、各Feature に渡す
const createApp = (env: Env, db: Db) =>
  new Hono()
    .route("/api/{feature-name}", create{FeatureName}Feature(env, db))
    // 他のFeatureも同様に追加

export type AppType = ReturnType<typeof createApp>
```
