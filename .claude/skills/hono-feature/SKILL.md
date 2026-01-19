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
import type { Result } from "@/shared/lib/result"
import { ok, err } from "@/shared/lib/result"
import type { {FeatureName}Repository } from "./repository"

type Deps = {
  repository: {FeatureName}Repository
}

export const create{FeatureName} = async (
  deps: Deps,
  input: Create{FeatureName}Input
): Promise<Result<{FeatureName}, {FeatureName}Error>> => {
  // 純粋なビジネスロジック
}
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
import {
  create{FeatureName}RequestSchema,
  {featureName}Schema,
} from "@cpa-study/shared/schemas"
import { create{FeatureName} } from "./usecase"
import type { {FeatureName}Repository } from "./repository"

type Deps = {
  repository: {FeatureName}Repository
}

// メソッドチェーンで型推論を活かす
export const {featureName}Routes = (deps: Deps) =>
  new Hono()
    .get("/:id", async (c) => {
      const id = c.req.param("id")
      const result = await deps.repository.findById(id)
      if (!result) return c.json({ error: "Not found" }, 404)
      return c.json(result)
    })
    .post(
      "/",
      zValidator("json", create{FeatureName}RequestSchema),
      async (c) => {
        const input = c.req.valid("json")
        const result = await create{FeatureName}(deps, input)

        if (!result.ok) {
          return c.json({ error: result.error }, 400)
        }

        return c.json(result.value, 201)
      }
    )
```

### index.ts（DI + 型エクスポート）
```typescript
import { createRepository } from "./repository"
import { {featureName}Routes } from "./route"

// Feature単位でDI
export const create{FeatureName}Feature = (env: Env) => {
  const deps = {
    repository: createRepository(env.DB),
  }
  return {featureName}Routes(deps)
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

const createApp = (env: Env) =>
  new Hono()
    .route("/api/{feature-name}", create{FeatureName}Feature(env))
    // 他のFeatureも同様に追加

export type AppType = ReturnType<typeof createApp>
```
