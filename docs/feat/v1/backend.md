# バックエンド設計

## アーキテクチャ方針

| 方針 | 内容 |
|-----|------|
| クリーンアーキテクチャ | 依存方向を内側（ドメイン）に統一 |
| Package by Feature | 機能ごとにフォルダを分離、削除・追加が容易 |
| 関数型 | クラス不使用、純粋関数中心、副作用は境界に |

---

## レイヤー構成

```
┌────────────────────────────────────────────────────┐
│  Route（Hono Handler）                             │
│  - HTTPリクエスト/レスポンスの変換                  │
│  - バリデーション（Zod）                           │
│  - UseCaseの呼び出し                               │
├────────────────────────────────────────────────────┤
│  UseCase（ビジネスロジック）                       │
│  - 純粋関数として実装                              │
│  - 依存は引数で注入（Repository, Service）         │
│  - Result<T, E> でエラーを表現                     │
├────────────────────────────────────────────────────┤
│  Domain（型 + ビジネスルール）                     │
│  - 型定義、バリデーション関数                      │
│  - 外部依存なし                                    │
├────────────────────────────────────────────────────┤
│  Repository / Service（インフラ）                  │
│  - DB操作、外部API呼び出し                         │
│  - 副作用はここに閉じ込める                        │
└────────────────────────────────────────────────────┘
```

---

## Feature フォルダ構成（例: chat）

```
features/chat/
├── index.ts           # ルートのエクスポート（Honoアプリ）
├── domain.ts          # 型定義、ドメインロジック
├── usecase.ts         # ビジネスロジック（純粋関数）
├── repository.ts      # DB操作（Drizzle）
├── service.ts         # 外部サービス呼び出し（AI API等）
└── route.ts           # Honoルート定義
```

---

## 関数型の原則

```typescript
// ❌ クラスベース
class ChatService {
  constructor(private db: D1Database) {}
  async sendMessage(sessionId: string, content: string) { ... }
}

// ✅ 関数ベース + 依存注入
type ChatDeps = {
  db: D1Database
  aiClient: OpenRouterClient
}

const sendMessage = async (
  deps: ChatDeps,
  input: SendMessageInput
): Promise<Result<ChatMessage, ChatError>> => {
  // 純粋なビジネスロジック
}
```

---

## Result型によるエラーハンドリング

```typescript
// shared/lib/result.ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

// 使用例
const createSession = async (
  deps: Deps,
  input: CreateSessionInput
): Promise<Result<ChatSession, "TOPIC_NOT_FOUND" | "DB_ERROR">> => {
  const topic = await deps.topicRepo.findById(input.topicId)
  if (!topic) return err("TOPIC_NOT_FOUND")

  const session = await deps.chatRepo.create({ ... })
  return ok(session)
}

// Routeでのハンドリング
route.post("/sessions", async (c) => {
  const result = await createSession(deps, input)

  if (!result.ok) {
    return match(result.error, {
      TOPIC_NOT_FOUND: () => c.json({ error: "Topic not found" }, 404),
      DB_ERROR: () => c.json({ error: "Internal error" }, 500),
    })
  }

  return c.json(result.value, 201)
})
```

---

## 依存注入パターン + Hono RPC

### 設計方針

- **Feature単位でDI**: 各FeatureのRouteでAdapter/Repositoryを注入
- **appはrouteを束ねるだけ**: 疎結合、Feature単位で捨てやすい
- **Hono RPC対応**: 型安全なクライアント生成

### Feature構成

```typescript
// features/chat/index.ts
import { Hono } from "hono"
import { createRepository } from "./repository"
import { createAIAdapter } from "@/shared/lib/ai"
import { chatRoutes } from "./route"

// Feature単位でDI → Routeを返す
export const createChatFeature = (env: Env) => {
  const deps = {
    chatRepo: createRepository(env.DB),
    aiAdapter: createAIAdapter({
      provider: env.AI_PROVIDER,
      apiKey: env.OPENROUTER_API_KEY,
    }),
  }

  return chatRoutes(deps)
}

// 型エクスポート（Hono RPC用）
export type ChatRoutes = ReturnType<typeof createChatFeature>
```

### Route定義（型推論を活かす）

```typescript
// features/chat/route.ts
import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { sendMessageRequestSchema } from "@cpa-study/shared/schemas"
import { streamToSSE } from "@/shared/lib/ai"
import { sendMessage } from "./usecase"

type Deps = {
  chatRepo: ChatRepository
  aiAdapter: AIAdapter
}

export const chatRoutes = (deps: Deps) => {
  const app = new Hono()
    .post(
      "/sessions",
      zValidator("json", createSessionRequestSchema),
      async (c) => {
        // ...
        return c.json(session, 201)
      }
    )
    .post(
      "/sessions/:id/messages/stream",
      zValidator("json", sendMessageRequestSchema),
      async (c) => {
        const stream = await sendMessage(deps, input)
        return streamToSSE(c, stream)
      }
    )

  return app  // 型が推論される
}
```

### App（routeを束ねる）

```typescript
// apps/api/src/index.ts
import { Hono } from "hono"
import { createAuthFeature, type AuthRoutes } from "./features/auth"
import { createTopicFeature, type TopicRoutes } from "./features/topic"
import { createChatFeature, type ChatRoutes } from "./features/chat"
import { createNoteFeature, type NoteRoutes } from "./features/note"

const createApp = (env: Env) => {
  const app = new Hono()
    .route("/api/auth", createAuthFeature(env))
    .route("/api/topics", createTopicFeature(env))
    .route("/api/chat", createChatFeature(env))
    .route("/api/notes", createNoteFeature(env))

  return app
}

export type AppType = ReturnType<typeof createApp>

export default {
  fetch: (req: Request, env: Env) => createApp(env).fetch(req, env),
}
```

### Hono RPCクライアント（フロントエンド）

```typescript
// apps/web/src/lib/api-client.ts
import { hc } from "hono/client"
import type { AppType } from "@cpa-study/api"

export const api = hc<AppType>(import.meta.env.VITE_API_URL)

// 型安全なAPI呼び出し
const sessions = await api.api.chat.sessions.$post({
  json: { topicId: "xxx" }
})

// エンドポイントの型が自動補完される
```

### Featureの追加・削除

```typescript
// 追加: features/quiz/ を作成
const app = new Hono()
  .route("/api/auth", createAuthFeature(env))
  .route("/api/topics", createTopicFeature(env))
  .route("/api/chat", createChatFeature(env))
  .route("/api/notes", createNoteFeature(env))
  .route("/api/quiz", createQuizFeature(env))  // 1行追加

// 削除: フォルダ削除 + 上記1行削除
// DIが閉じているので他に影響なし
```

---

## テスト容易性

```typescript
// usecase.test.ts
import { sendMessage } from "./usecase"

test("sendMessage returns error when session not found", async () => {
  // モックを注入
  const mockDeps = {
    chatRepo: {
      findSession: async () => null,
    },
    aiClient: { generate: vi.fn() },
  }

  const result = await sendMessage(mockDeps, { sessionId: "xxx", content: "test" })

  expect(result.ok).toBe(false)
  expect(result.error).toBe("SESSION_NOT_FOUND")
})
```

---

## 共有スキーマ（バックエンドでの使用）

```typescript
// apps/api/src/features/chat/route.ts
import { zValidator } from "@hono/zod-validator"
import { sendMessageRequestSchema, chatMessageSchema } from "@cpa-study/shared/schemas"

route.post(
  "/sessions/:sessionId/messages",
  zValidator("json", sendMessageRequestSchema),
  async (c) => {
    const input = c.req.valid("json")  // 型安全
    const result = await sendMessage(deps, input)

    // レスポンスもスキーマで検証（開発時のみ）
    if (import.meta.env.DEV) {
      chatMessageSchema.parse(result.value)
    }

    return c.json(result.value)
  }
)
```

---

## DBスキーマ

### テーブル一覧

| テーブル | 説明 |
|---------|------|
| users | ユーザー（プロバイダー非依存） |
| user_oauth_connections | OAuth接続（複数プロバイダー対応） |
| subjects | 科目（財務会計論など） |
| categories | 大分類 |
| topics | 論点 |
| user_topic_progress | ユーザー別進捗 |
| chat_sessions | チャットセッション |
| chat_messages | チャットメッセージ |
| notes | ノート（AI要約 + ユーザーメモ） |
| images | 画像メタデータ |

### 主要カラム

**topics**
- id, category_id, name, description
- difficulty (basic/intermediate/advanced)
- topic_type (theory/calculation/mixed)
- ai_system_prompt（論点固有のAI指示）

**chat_messages**
- role (user/assistant/system)
- content, image_id, ocr_result
- question_quality (good/surface/null)

**notes**
- ai_summary（AI生成要約）
- user_memo（ユーザー自由記述）
- key_points, stumbled_points（JSON配列）

---

## APIエンドポイント

### 認証
- `GET /api/auth/:provider` - OAuth開始
- `GET /api/auth/:provider/callback` - コールバック
- `GET /api/auth/providers` - 利用可能プロバイダー一覧
- `POST /api/auth/refresh` - トークン更新
- `GET /api/auth/me` - ユーザー情報

### 科目・論点
- `GET /api/subjects` - 科目一覧
- `GET /api/subjects/:id` - 科目詳細
- `GET /api/categories/:id/topics` - 論点一覧
- `GET /api/topics/:id` - 論点詳細

### チャット
- `POST /api/topics/:id/sessions` - セッション作成
- `POST /api/sessions/:id/messages/stream` - メッセージ送信（SSE）

### 画像
- `POST /api/images/upload` - アップロード
- `POST /api/images/:id/ocr` - OCR実行

### ノート
- `POST /api/sessions/:id/notes` - ノート生成
- `PUT /api/notes/:id` - ユーザーメモ更新

---

## AI処理フロー

```
[質問] → [画像あり?] → [OCR AI] → [構造化テキスト]
                ↓
        [回答AI (DeepSeek-V3)] ← 論点固有システムプロンプト
                ↓
        [評価AI] → ✔︎ or △
                ↓
        [DB保存] → [クライアントへストリーミング]
```

### AIモデル

| AI | モデル | 役割 |
|----|--------|------|
| 回答AI | deepseek/deepseek-chat | 論点質問回答 |
| OCR AI | openai/gpt-4o-mini | 画像→テキスト |
| 評価AI | deepseek/deepseek-chat | 質問の質判定 |
| 要約AI | deepseek/deepseek-chat | ノート生成 |

### AI Adapter設計

AIクライアントを抽象化し、実装（Vercel AI SDK / Mastra / Mock等）を差し替え可能にする。

#### 設計方針

- **ストリーミング実装の差異を吸収**: 各フレームワーク固有のStream形式を統一
- **SSE変換を統一**: Adapter層でSSE形式まで責任を持つ
- **モック対応**: 開発初期はAI疎通なしで開発可能に
- **依存注入**: UseCaseはインターフェースにのみ依存

#### ディレクトリ構成

```
apps/api/src/shared/lib/ai/
├── types.ts              # インターフェース定義
├── adapters/
│   ├── vercel-ai.ts      # Vercel AI SDK実装
│   ├── mastra.ts         # Mastra実装（将来）
│   └── mock.ts           # モック実装（開発用）
├── sse.ts                # SSE変換ユーティリティ
└── index.ts              # Factory + エクスポート
```

#### インターフェース

```typescript
// shared/lib/ai/types.ts

export type AIMessage = {
  role: "system" | "user" | "assistant"
  content: string
  imageUrl?: string
}

export type GenerateTextInput = {
  model: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
}

export type StreamTextInput = GenerateTextInput

export type GenerateTextResult = {
  content: string
  usage?: { promptTokens: number; completionTokens: number }
}

// ストリーミングチャンク（フレームワーク非依存）
export type StreamChunk = {
  type: "text" | "error" | "done"
  content?: string
  error?: string
}

// Adapter インターフェース
export type AIAdapter = {
  generateText: (input: GenerateTextInput) => Promise<GenerateTextResult>
  streamText: (input: StreamTextInput) => AsyncIterable<StreamChunk>
}
```

#### SSE変換ユーティリティ

```typescript
// shared/lib/ai/sse.ts
import type { StreamChunk } from "./types"
import type { Context } from "hono"

// AsyncIterable<StreamChunk> → SSE Response
export const streamToSSE = (
  c: Context,
  stream: AsyncIterable<StreamChunk>
): Response => {
  return c.stream(async (writer) => {
    try {
      for await (const chunk of stream) {
        const event = formatSSEEvent(chunk)
        await writer.write(event)
      }
    } catch (error) {
      await writer.write(formatSSEEvent({ type: "error", error: String(error) }))
    }
  }, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}

const formatSSEEvent = (chunk: StreamChunk): string => {
  return `data: ${JSON.stringify(chunk)}\n\n`
}
```

#### Vercel AI SDK実装

```typescript
// shared/lib/ai/adapters/vercel-ai.ts
import { generateText, streamText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { AIAdapter, StreamChunk } from "../types"

export const createVercelAIAdapter = (apiKey: string): AIAdapter => {
  const openrouter = createOpenRouter({ apiKey })

  return {
    generateText: async (input) => {
      const result = await generateText({
        model: openrouter(input.model),
        messages: input.messages,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      })
      return { content: result.text, usage: result.usage }
    },

    streamText: async function* (input): AsyncIterable<StreamChunk> {
      try {
        const result = streamText({
          model: openrouter(input.model),
          messages: input.messages,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
        })
        for await (const text of result.textStream) {
          yield { type: "text", content: text }
        }
        yield { type: "done" }
      } catch (error) {
        yield { type: "error", error: String(error) }
      }
    },
  }
}
```

#### モック実装（開発用）

```typescript
// shared/lib/ai/adapters/mock.ts
import type { AIAdapter, StreamChunk, GenerateTextInput } from "../types"

type MockResponse = {
  pattern: RegExp | string
  response: string
  delay?: number  // ストリーミング遅延（ms）
}

const defaultMockResponses: MockResponse[] = [
  {
    pattern: /収益認識/,
    response: "収益認識の5ステップモデルについて説明します。\n\n1. 契約の識別\n2. 履行義務の識別\n3. 取引価格の算定\n4. 取引価格の配分\n5. 収益の認識\n\nこれらのステップを順に適用することで...",
    delay: 50,
  },
  {
    pattern: /.*/,
    response: "これはモックレスポンスです。実際のAI応答は本番環境で確認してください。",
    delay: 30,
  },
]

export const createMockAdapter = (
  customResponses?: MockResponse[]
): AIAdapter => {
  const responses = customResponses ?? defaultMockResponses

  const findResponse = (input: GenerateTextInput): MockResponse => {
    const lastMessage = input.messages[input.messages.length - 1]
    const content = lastMessage?.content ?? ""

    return responses.find((r) =>
      typeof r.pattern === "string"
        ? content.includes(r.pattern)
        : r.pattern.test(content)
    ) ?? responses[responses.length - 1]
  }

  return {
    generateText: async (input) => {
      const mock = findResponse(input)
      await sleep(100)
      return { content: mock.response }
    },

    streamText: async function* (input): AsyncIterable<StreamChunk> {
      const mock = findResponse(input)
      const words = mock.response.split("")

      for (const char of words) {
        await sleep(mock.delay ?? 30)
        yield { type: "text", content: char }
      }
      yield { type: "done" }
    },
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
```

#### Factory

```typescript
// shared/lib/ai/index.ts
import { createVercelAIAdapter } from "./adapters/vercel-ai"
import { createMockAdapter } from "./adapters/mock"
import type { AIAdapter } from "./types"

export type AIProvider = "vercel-ai" | "mastra" | "mock"

type AIAdapterConfig = {
  provider: AIProvider
  apiKey?: string
}

export const createAIAdapter = (config: AIAdapterConfig): AIAdapter => {
  switch (config.provider) {
    case "vercel-ai":
      if (!config.apiKey) throw new Error("API key required for vercel-ai")
      return createVercelAIAdapter(config.apiKey)
    case "mock":
      return createMockAdapter()
    case "mastra":
      throw new Error("Mastra adapter not implemented yet")
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}

export { streamToSSE } from "./sse"
export type { AIAdapter, AIMessage, StreamChunk, GenerateTextInput, StreamTextInput } from "./types"
```

#### Route層での使用

```typescript
// features/chat/route.ts
import { streamToSSE, createAIAdapter } from "@/shared/lib/ai"

app.post("/sessions/:id/messages/stream", async (c) => {
  const aiAdapter = createAIAdapter({
    provider: env.AI_PROVIDER,  // "mock" | "vercel-ai"
    apiKey: env.OPENROUTER_API_KEY,
  })

  const stream = await sendMessage({ aiAdapter, ...deps }, input)

  // SSE変換（Adapter層が統一済みなので1行）
  return streamToSSE(c, stream)
})
```

#### 環境変数での切り替え

```bash
# .dev.vars（開発）
AI_PROVIDER=mock

# wrangler.toml（本番）
[vars]
AI_PROVIDER = "vercel-ai"
```

---

## 認証設計

### 設計方針
- **プロバイダー抽象化**: OAuth プロバイダーを差し替え可能に
- **MVP**: Google のみ実装
- **将来対応**: GitHub, Apple, Microsoft 等を追加可能
- **開発環境**: 認証スキップ + テストユーザー機能

### 開発環境の認証スキップ

開発時にcurlやPlaywrightで直接APIを叩けるようにする。

#### 環境変数

```bash
# .dev.vars（開発環境のみ）
AUTH_MODE=dev           # "dev" | "production"
DEV_USER_ID=test-user-1 # デフォルトのテストユーザーID
```

#### 認証ミドルウェア

```typescript
// shared/middleware/auth.ts
import { createMiddleware } from "hono/factory"
import type { Context } from "hono"

type AuthEnv = {
  AUTH_MODE: "dev" | "production"
  DEV_USER_ID?: string
  JWT_SECRET: string
}

export const authMiddleware = createMiddleware<{ Bindings: AuthEnv }>(
  async (c, next) => {
    // 開発モード: 認証スキップ
    if (c.env.AUTH_MODE === "dev") {
      const devUser = getDevUser(c)
      c.set("user", devUser)
      return next()
    }

    // 本番モード: JWT検証
    const token = c.req.header("Authorization")?.replace("Bearer ", "")
    if (!token) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const user = await verifyJWT(token, c.env.JWT_SECRET)
    if (!user) {
      return c.json({ error: "Invalid token" }, 401)
    }

    c.set("user", user)
    return next()
  }
)

// 開発用ユーザー取得
const getDevUser = (c: Context<{ Bindings: AuthEnv }>): User => {
  // ヘッダーでユーザー切り替え可能
  const userId = c.req.header("X-Dev-User-Id") ?? c.env.DEV_USER_ID ?? "test-user-1"
  const userName = c.req.header("X-Dev-User-Name") ?? "テストユーザー"

  return {
    id: userId,
    email: `${userId}@example.com`,
    name: userName,
    avatarUrl: null,
  }
}
```

#### 使用方法

```bash
# デフォルトテストユーザーでAPI呼び出し
curl http://localhost:8787/api/auth/me

# 特定ユーザーを指定
curl http://localhost:8787/api/auth/me \
  -H "X-Dev-User-Id: user-123" \
  -H "X-Dev-User-Name: 山田太郎"

# 認証が必要なエンドポイント
curl -X POST http://localhost:8787/api/topics/topic-1/sessions \
  -H "Content-Type: application/json"
```

#### テストユーザーシード

```typescript
// packages/db/seed/dev-users.ts
export const devUsers = [
  {
    id: "test-user-1",
    email: "test1@example.com",
    name: "テストユーザー1",
    avatarUrl: null,
  },
  {
    id: "test-user-2",
    email: "test2@example.com",
    name: "テストユーザー2",
    avatarUrl: null,
  },
  {
    id: "test-admin",
    email: "admin@example.com",
    name: "管理者テスト",
    avatarUrl: null,
  },
]
```

#### Playwright MCP での動作確認

```typescript
// E2Eテストでも開発モードを使用
// ログイン画面をスキップして直接認証済み状態に

// 1. APIを直接叩いてセッション作成
const session = await api.api.topics["topic-1"].sessions.$post()

// 2. Playwrightでチャット画面を開く
await page.goto(`/subjects/1/categories/1/topics/topic-1`)

// 3. チャット機能をテスト
await page.fill('[data-testid="chat-input"]', '質問内容')
await page.click('[data-testid="send-button"]')

// 4. ストリーミングレスポンスを確認
await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible()
```

#### 本番環境での無効化

```typescript
// wrangler.toml
[vars]
AUTH_MODE = "production"  # 開発機能は無効

// 本番では X-Dev-* ヘッダーは無視される
```

### プロバイダーインターフェース

```typescript
// features/auth/domain.ts

type OAuthProvider = {
  name: string  // "google" | "github" | "apple" | ...
  getAuthUrl: (state: string) => string
  exchangeCode: (code: string) => Promise<OAuthTokens>
  getUserInfo: (accessToken: string) => Promise<OAuthUserInfo>
}

type OAuthUserInfo = {
  providerId: string
  email: string
  name: string
  avatarUrl: string | null
}

type UserOAuthConnection = {
  id: string
  userId: string
  provider: string        // "google" | "github" | ...
  providerId: string
  createdAt: Date
}
```

### プロバイダー実装例

```typescript
// features/auth/providers/google.ts
export const createGoogleProvider = (config: {
  clientId: string
  clientSecret: string
  redirectUri: string
}): OAuthProvider => ({
  name: "google",

  getAuthUrl: (state) => {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  },

  exchangeCode: async (code) => {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    })
    return res.json()
  },

  getUserInfo: async (accessToken) => {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()
    return {
      providerId: data.id,
      email: data.email,
      name: data.name,
      avatarUrl: data.picture,
    }
  },
})
```

### プロバイダーレジストリ

```typescript
// features/auth/providers/index.ts
export const createProviders = (env: Env) => {
  const providers: Record<string, OAuthProvider> = {
    google: createGoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${env.API_BASE_URL}/api/auth/google/callback`,
    }),
    // github: createGitHubProvider({ ... }),  // 将来追加
  }

  return {
    get: (name: string) => providers[name],
    list: () => Object.keys(providers),
  }
}
```

### 認証UseCase

```typescript
// features/auth/usecase.ts

export const handleOAuthCallback = async (
  deps: AuthDeps,
  providerName: string,
  code: string
): Promise<Result<{ user: User; isNewUser: boolean }, AuthError>> => {
  const provider = deps.providers.get(providerName)
  if (!provider) return err("PROVIDER_NOT_FOUND")

  const tokens = await provider.exchangeCode(code)
  if (!tokens.access_token) return err("TOKEN_EXCHANGE_FAILED")

  const oauthUser = await provider.getUserInfo(tokens.access_token)

  // 既存接続を確認
  const existingConnection = await deps.connectionRepo.findByProviderAndId(
    providerName,
    oauthUser.providerId
  )

  if (existingConnection) {
    const user = await deps.userRepo.findById(existingConnection.userId)
    return ok({ user, isNewUser: false })
  }

  // 同じメールの既存ユーザーに接続追加、または新規作成
  const existingUserByEmail = await deps.userRepo.findByEmail(oauthUser.email)

  if (existingUserByEmail) {
    await deps.connectionRepo.create({
      userId: existingUserByEmail.id,
      provider: providerName,
      providerId: oauthUser.providerId,
    })
    return ok({ user: existingUserByEmail, isNewUser: false })
  }

  const newUser = await deps.userRepo.create({
    email: oauthUser.email,
    name: oauthUser.name,
    avatarUrl: oauthUser.avatarUrl,
  })

  await deps.connectionRepo.create({
    userId: newUser.id,
    provider: providerName,
    providerId: oauthUser.providerId,
  })

  return ok({ user: newUser, isNewUser: true })
}
```

### DBスキーマ（認証）

```typescript
// packages/db/src/schema/auth.ts

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const userOAuthConnections = sqliteTable("user_oauth_connections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
  uniqueProviderConnection: unique().on(table.provider, table.providerId),
}))
```

### 認証フロー図

```
[ユーザー] → GET /api/auth/:provider → [プロバイダー選択]
                                              ↓
                                    [OAuth画面へリダイレクト]
                                              ↓
[認証許可] → GET /api/auth/:provider/callback
                     ↓
           [プロバイダーからトークン取得]
                     ↓
           [ユーザー情報取得（正規化）]
                     ↓
           [user_oauth_connections で検索]
                     ↓
        ┌───────────┴───────────┐
        ↓                       ↓
   [既存接続あり]          [新規接続]
        ↓                       ↓
   [ユーザー取得]     [メールで既存ユーザー検索]
        ↓                       ↓
        │            ┌──────────┴──────────┐
        │            ↓                     ↓
        │     [既存ユーザーに         [新規ユーザー作成]
        │      接続追加]                   ↓
        │            ↓              [接続作成]
        └────────────┴──────────────────────┘
                     ↓
              [JWT生成 → Cookie → リダイレクト]
```
