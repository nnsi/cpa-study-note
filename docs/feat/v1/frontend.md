# フロントエンド設計

## アーキテクチャ方針

| レイヤー | 役割 | 特徴 |
|---------|------|------|
| Logic | 純粋なビジネスロジック | UIに依存しない、テスト容易 |
| UI Hooks | UI状態管理、イベントハンドラ | Reactに依存、副作用を含む |
| Component | 純粋なUI | propsを受け取り描画のみ |

---

## Feature フォルダ構成（例: chat）

```
features/chat/
├── index.ts           # 公開APIのエクスポート
├── logic.ts           # 純粋なビジネスロジック
├── hooks.ts           # UI Hooks（状態管理）
├── components/        # UIコンポーネント
│   ├── ChatContainer.tsx
│   ├── ChatMessage.tsx
│   ├── ChatInput.tsx
│   └── index.ts
├── api.ts             # API呼び出し
└── types.ts           # feature固有の型（必要なら）
```

---

## レイヤー詳細

### Logic（純粋関数）

```typescript
// features/chat/logic.ts

// メッセージのフィルタリング（純粋関数）
export const filterMessagesByRole = (
  messages: ChatMessage[],
  role: ChatMessage["role"]
): ChatMessage[] => messages.filter((m) => m.role === role)

// 質問の質をカウント（純粋関数）
export const countQuestionQuality = (messages: ChatMessage[]) => {
  const userMessages = filterMessagesByRole(messages, "user")
  return {
    total: userMessages.length,
    good: userMessages.filter((m) => m.questionQuality === "good").length,
    surface: userMessages.filter((m) => m.questionQuality === "surface").length,
  }
}

// メッセージリストの整形（純粋関数）
export const formatMessagesForDisplay = (messages: ChatMessage[]) =>
  messages.map((m) => ({
    ...m,
    formattedTime: new Date(m.createdAt).toLocaleTimeString(),
    isUser: m.role === "user",
  }))
```

### UI Hooks（状態管理 + イベントハンドラ）

```typescript
// features/chat/hooks.ts
import { useState, useCallback } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import * as api from "./api"
import * as logic from "./logic"

export const useChatMessages = (sessionId: string) => {
  const { data: messages = [], ...query } = useQuery({
    queryKey: ["chat", sessionId, "messages"],
    queryFn: () => api.getMessages(sessionId),
  })

  // Logicを使って派生データを計算
  const displayMessages = logic.formatMessagesForDisplay(messages)
  const qualityStats = logic.countQuestionQuality(messages)

  return { messages, displayMessages, qualityStats, ...query }
}

export const useChatInput = (sessionId: string) => {
  const [content, setContent] = useState("")
  const [imageId, setImageId] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (input: { content: string; imageId?: string }) =>
      api.sendMessage(sessionId, input),
  })

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
  }, [])

  const handleImageSelect = useCallback((id: string) => {
    setImageId(id)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) return

    await mutation.mutateAsync({
      content,
      imageId: imageId ?? undefined,
    })

    setContent("")
    setImageId(null)
  }, [content, imageId, mutation])

  return {
    content,
    imageId,
    isSubmitting: mutation.isPending,
    error: mutation.error,
    handleContentChange,
    handleImageSelect,
    handleSubmit,
  }
}

// 複合Hook（複数のhooksを組み合わせ）
export const useChat = (sessionId: string) => {
  const messages = useChatMessages(sessionId)
  const input = useChatInput(sessionId)

  return { messages, input }
}
```

### Component（純粋なUI）

```typescript
// features/chat/components/ChatMessage.tsx
import { type ChatMessage } from "@cpa-study/shared/schemas"

type Props = {
  message: ChatMessage & { formattedTime: string; isUser: boolean }
}

// 純粋なUIコンポーネント（状態を持たない）
export const ChatMessageView = ({ message }: Props) => (
  <div className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
    <div className={`rounded-lg p-3 ${message.isUser ? "bg-blue-100" : "bg-gray-100"}`}>
      <p>{message.content}</p>
      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
        <span>{message.formattedTime}</span>
        {message.questionQuality && (
          <span>{message.questionQuality === "good" ? "✔︎" : "△"}</span>
        )}
      </div>
    </div>
  </div>
)
```

```typescript
// features/chat/components/ChatInput.tsx
type Props = {
  content: string
  isSubmitting: boolean
  onContentChange: (value: string) => void
  onImageSelect: (id: string) => void
  onSubmit: () => void
}

// 純粋なUIコンポーネント（イベントハンドラはpropsで受け取る）
export const ChatInputView = ({
  content,
  isSubmitting,
  onContentChange,
  onImageSelect,
  onSubmit,
}: Props) => (
  <div className="flex gap-2 p-4 border-t">
    <button onClick={() => {/* 画像選択UI */}}>📷</button>
    <input
      value={content}
      onChange={(e) => onContentChange(e.target.value)}
      placeholder="質問を入力..."
      className="flex-1 px-3 py-2 border rounded"
      disabled={isSubmitting}
    />
    <button
      onClick={onSubmit}
      disabled={isSubmitting || !content.trim()}
      className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
    >
      送信
    </button>
  </div>
)
```

```typescript
// features/chat/components/ChatContainer.tsx
import { useChat } from "../hooks"
import { ChatMessageView } from "./ChatMessage"
import { ChatInputView } from "./ChatInput"

type Props = {
  sessionId: string
}

// Container: Hooksを呼び出し、純粋なUIに渡す
export const ChatContainer = ({ sessionId }: Props) => {
  const { messages, input } = useChat(sessionId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.displayMessages.map((msg) => (
          <ChatMessageView key={msg.id} message={msg} />
        ))}
      </div>
      <ChatInputView
        content={input.content}
        isSubmitting={input.isSubmitting}
        onContentChange={input.handleContentChange}
        onImageSelect={input.handleImageSelect}
        onSubmit={input.handleSubmit}
      />
    </div>
  )
}
```

---

## Route（ページ）での使用

```typescript
// routes/subjects/$subjectId/$categoryId/$topicId.tsx
import { createFileRoute } from "@tanstack/react-router"
import { ChatContainer } from "@/features/chat"
import { TopicInfo } from "@/features/topic"

export const Route = createFileRoute("/subjects/$subjectId/$categoryId/$topicId")({
  component: TopicPage,
})

function TopicPage() {
  const { topicId } = Route.useParams()
  const sessionId = useCurrentSession(topicId)

  return (
    <div className="flex gap-6">
      <aside className="w-1/3">
        <TopicInfo topicId={topicId} />
      </aside>
      <main className="w-2/3">
        <ChatContainer sessionId={sessionId} />
      </main>
    </div>
  )
}
```

---

## APIクライアント（Hono RPC）

Hono RPCを使用して型安全なAPIクライアントを生成する。

### クライアント設定

```typescript
// apps/web/src/lib/api-client.ts
import { hc } from "hono/client"
import type { AppType } from "@cpa-study/api"

export const api = hc<AppType>(import.meta.env.VITE_API_URL, {
  headers: () => {
    const token = getAuthToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
})
```

### Feature内での使用

```typescript
// apps/web/src/features/chat/api.ts
import { api } from "@/lib/api-client"

// 型安全：エンドポイント・リクエスト・レスポンスすべて型補完
export const createSession = async (topicId: string) => {
  const res = await api.api.chat.sessions.$post({
    json: { topicId },
  })
  if (!res.ok) throw new Error("Failed to create session")
  return res.json()
}

export const getMessages = async (sessionId: string) => {
  const res = await api.api.chat.sessions[":id"].messages.$get({
    param: { id: sessionId },
  })
  return res.json()
}
```

### SSEストリーミングの消費

```typescript
// apps/web/src/features/chat/api.ts
import type { StreamChunk } from "@cpa-study/shared/types"

export const streamMessage = async function* (
  sessionId: string,
  content: string
): AsyncIterable<StreamChunk> {
  const res = await api.api.chat.sessions[":id"].messages.stream.$post({
    param: { id: sessionId },
    json: { content },
  })

  if (!res.ok || !res.body) throw new Error("Stream failed")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const lines = text.split("\n\n").filter(Boolean)

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const chunk: StreamChunk = JSON.parse(line.slice(6))
        yield chunk
        if (chunk.type === "done" || chunk.type === "error") return
      }
    }
  }
}
```

### Hooks での使用

```typescript
// apps/web/src/features/chat/hooks.ts
import { useMutation } from "@tanstack/react-query"
import { streamMessage } from "./api"

export const useSendMessage = (sessionId: string) => {
  const [streamingText, setStreamingText] = useState("")

  const mutation = useMutation({
    mutationFn: async (content: string) => {
      setStreamingText("")
      for await (const chunk of streamMessage(sessionId, content)) {
        if (chunk.type === "text") {
          setStreamingText((prev) => prev + chunk.content)
        }
      }
    },
  })

  return { streamingText, ...mutation }
}
```

### 利点

| 観点 | 説明 |
|------|------|
| 型安全 | APIの型がバックエンドから自動推論 |
| 補完 | エンドポイント・パラメータ・ボディすべて補完 |
| 一貫性 | Zodスキーマはバックエンドでのバリデーション用に集中 |
| 保守性 | API変更時にフロントでコンパイルエラー |

---

## テスト戦略

```typescript
// Logic: 純粋関数なので単体テスト容易
// features/chat/logic.test.ts
test("countQuestionQuality counts correctly", () => {
  const messages = [
    { role: "user", questionQuality: "good" },
    { role: "user", questionQuality: "surface" },
    { role: "assistant", questionQuality: null },
  ]
  expect(logic.countQuestionQuality(messages)).toEqual({
    total: 2,
    good: 1,
    surface: 1,
  })
})

// UI Hooks: React Testing Libraryでテスト
// features/chat/hooks.test.ts
test("useChatInput clears content after submit", async () => {
  const { result } = renderHook(() => useChatInput("session-1"))

  act(() => result.current.handleContentChange("test"))
  expect(result.current.content).toBe("test")

  await act(() => result.current.handleSubmit())
  expect(result.current.content).toBe("")
})

// Component: Storybookでビジュアルテスト
// features/chat/components/ChatMessage.stories.tsx
export const UserMessage: Story = {
  args: {
    message: {
      id: "1",
      content: "これはテストメッセージです",
      role: "user",
      questionQuality: "good",
      formattedTime: "12:34",
      isUser: true,
    },
  },
}
```

---

## 画面構成

```
/login              - ログイン
/                   - ダッシュボード
/subjects           - 科目一覧（論点マップ入口）
/subjects/:subjectId
  /:categoryId
    /:topicId       - 論点詳細 + AIチャット（メイン画面）
/notes              - ノート一覧
/notes/:noteId      - ノート詳細
```

---

## PCレイアウト（lg以上）

```
┌─────────────────────────────────────────────────────────────┐
│ Header: ロゴ / ユーザーアバター                              │
├────────────┬────────────────────────────────────────────────┤
│ Sidebar    │  パンくず: 財務会計論 > 企業会計基準 > 収益認識  │
│            ├─────────────────┬──────────────────────────────┤
│ ・論点マップ │ 論点情報        │  AIチャット                  │
│ ・ノート    │                 │                              │
│            │ [✓] 理解済み    │  [User] なぜ...  ✔︎          │
│            │                 │  [AI] それは...              │
│            │ 質問数: 15      │                              │
│            │ 良質問: 8       │  ─────────────────────────── │
│            │                 │  [📷] [入力...]    [送信]    │
│            │ [ノート一覧]    │  [ノートを作成]              │
└────────────┴─────────────────┴──────────────────────────────┘
```

---

## モバイルレイアウト（sm〜md）

### 基本方針
- ボトムナビゲーション採用（サイドバー非表示）
- 論点詳細画面はタブ切り替え式
- チャット入力は画面下部固定
- 画像アップロードはカメラ直接起動対応

### ボトムナビゲーション

```
┌─────────────────────────────────────┐
│                                     │
│          コンテンツエリア            │
│                                     │
├─────────────────────────────────────┤
│  🏠     📚      💬      📝         │
│ ホーム  論点    チャット  ノート     │
└─────────────────────────────────────┘
```

### 科目一覧（モバイル）

```
┌─────────────────────────────────────┐
│ ← 論点マップ                    👤  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📘 財務会計論               │   │
│  │    32/120 論点完了          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📗 管理会計論               │   │
│  │    18/80 論点完了           │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📙 監査論                   │   │
│  │    25/60 論点完了           │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📕 企業法                   │   │
│  │    40/90 論点完了           │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  🏠     📚      💬      📝         │
└─────────────────────────────────────┘
```

### 論点詳細（モバイル）- タブ切り替え式

```
┌─────────────────────────────────────┐
│ ← 収益認識の基本原則            👤  │
├─────────────────────────────────────┤
│  [ 情報 ]  [ チャット ]  [ ノート ] │
├─────────────────────────────────────┤
│                                     │
│  （選択中タブのコンテンツ）         │
│                                     │
└─────────────────────────────────────┘
```

#### 「情報」タブ

```
│  難易度: ⭐ 基礎                    │
│  形式: 理論 / 計算                  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [✓] 理解済みとしてマーク    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ── 学習統計 ──                    │
│  質問数: 15                         │
│  良質な質問: 8 (53%)                │
│  最終アクセス: 2時間前              │
│                                     │
│  ── 論点の説明 ──                  │
│  収益認識に関する会計基準の         │
│  5ステップモデルについて...         │
```

#### 「チャット」タブ

```
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 5ステップモデルの最初の     │   │
│  │ ステップは何ですか？    △  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 5ステップモデルの最初は     │   │
│  │ 「契約の識別」です。        │   │
│  │ 契約とは...                 │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ なぜ契約の識別が最初に      │   │
│  │ 必要なのですか？        ✔︎ │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│ [📷] [質問を入力...]        [送信] │
└─────────────────────────────────────┘
```

- 📷 タップでカメラ起動 or ギャラリー選択
- キーボード表示時は入力欄が上に追従

#### 「ノート」タブ

```
│                                     │
│  ── AI要約 ──                      │
│  収益認識の5ステップについて        │
│  理解を深めた。特に契約の識別が...  │
│                                     │
│  ── つまずきポイント ──            │
│  • 履行義務の充足タイミング         │
│  • 変動対価の見積もり               │
│                                     │
│  ── 自分のメモ ──                  │
│  ┌─────────────────────────────┐   │
│  │ ここに自由にメモを追加...   │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [チャットから新規ノート作成]       │
│                                     │
│  ── 過去のノート ──                │
│  • 2024/01/15 - 5ステップ基礎      │
│  • 2024/01/10 - 契約の識別         │
```

### 画像アップロードフロー（モバイル）

```
[📷タップ]
    ↓
┌─────────────────────────────────────┐
│                                     │
│   ┌───────────┐  ┌───────────┐    │
│   │  📷       │  │  🖼️       │    │
│   │ カメラで  │  │ ギャラリー │    │
│   │ 撮影      │  │ から選択   │    │
│   └───────────┘  └───────────┘    │
│                                     │
│         [ キャンセル ]              │
└─────────────────────────────────────┘
    ↓
[撮影/選択後]
    ↓
┌─────────────────────────────────────┐
│ プレビュー                     ✕   │
├─────────────────────────────────────┤
│                                     │
│   ┌─────────────────────────┐      │
│   │                         │      │
│   │    [選択した画像]       │      │
│   │                         │      │
│   └─────────────────────────┘      │
│                                     │
│  この画像の問題について質問します   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 質問を入力（任意）...       │   │
│  └─────────────────────────────┘   │
│                                     │
│  [ キャンセル ]    [ 送信 ]        │
└─────────────────────────────────────┘
```

---

## レスポンシブブレークポイント

| ブレークポイント | 幅 | レイアウト |
|-----------------|-----|-----------|
| sm | 〜639px | モバイル（タブ式、ボトムナビ） |
| md | 640〜1023px | タブレット（サイドバー折りたたみ） |
| lg | 1024px〜 | PC（2カラム、サイドバー常時表示） |

---

## ログイン画面

```typescript
// features/auth/components/LoginButtons.tsx
type Props = {
  providers: string[]
  onSelect: (provider: string) => void
}

const providerConfig = {
  google: { label: "Googleでログイン", icon: GoogleIcon },
  github: { label: "GitHubでログイン", icon: GitHubIcon },
  apple: { label: "Appleでログイン", icon: AppleIcon },
}

export const LoginButtons = ({ providers, onSelect }: Props) => (
  <div className="space-y-3">
    {providers.map((provider) => {
      const config = providerConfig[provider]
      return (
        <button
          key={provider}
          onClick={() => onSelect(provider)}
          className="w-full flex items-center gap-3 px-4 py-3 border rounded-lg"
        >
          <config.icon className="w-5 h-5" />
          {config.label}
        </button>
      )
    })}
  </div>
)

// hooks.ts
export const useLogin = () => {
  const handleLogin = (provider: string) => {
    window.location.href = `/api/auth/${provider}`
  }

  return { handleLogin }
}
```
