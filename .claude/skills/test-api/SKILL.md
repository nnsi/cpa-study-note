---
name: test-api
description: APIエンドポイントをテストする
---

# APIテスト

Hono APIのエンドポイントをテストし、動作確認を行う。

## 重要: 自己検証の原則

**実装後は必ず以下を確認すること:**

1. **curlでエンドポイントを叩いて想定値が取得できるか確認**
2. **Playwright MCPでブラウザ上の動作を確認**

---

## 環境設定

### 開発モードの設定

```bash
# .dev.vars（開発環境）
AUTH_MODE=dev           # 認証スキップ有効
DEV_USER_ID=test-user-1 # デフォルトテストユーザー
AI_PROVIDER=mock        # AIモック有効
```

開発モードでは認証なしでAPIを直接叩ける。

---

## 1. curlでのエンドポイント検証

### 認証（開発モード）

```bash
# 認証スキップ: ヘッダーなしでOK
curl http://localhost:8787/api/auth/me

# 特定ユーザーを指定
curl http://localhost:8787/api/auth/me \
  -H "X-Dev-User-Id: user-123" \
  -H "X-Dev-User-Name: 山田太郎"
```

### 科目・論点

```bash
# 科目一覧取得 → 配列が返ることを確認
curl http://localhost:8787/api/subjects | jq

# 期待値: [{ "id": "...", "name": "財務会計論", ... }, ...]

# 論点詳細 → オブジェクトが返ることを確認
curl http://localhost:8787/api/topics/{topicId} | jq

# 期待値: { "id": "...", "name": "収益認識", "categoryId": "...", ... }
```

### チャット

```bash
# セッション作成 → 201とセッションIDが返ることを確認
curl -X POST http://localhost:8787/api/topics/{topicId}/sessions \
  -H "Content-Type: application/json" | jq

# 期待値: { "id": "session-xxx", "topicId": "...", "userId": "test-user-1" }

# メッセージ送信（SSE）→ ストリーミングレスポンスを確認
curl -N -X POST http://localhost:8787/api/sessions/{sessionId}/messages/stream \
  -H "Content-Type: application/json" \
  -d '{"content": "収益認識について教えて"}'

# 期待値（モック）:
# data: {"type":"text","content":"こ"}
# data: {"type":"text","content":"れ"}
# ...
# data: {"type":"done"}
```

### 検証チェックリスト

- [ ] ステータスコードが期待通り（200, 201, 400, 404等）
- [ ] レスポンスボディの構造が正しい
- [ ] 必須フィールドが含まれている
- [ ] エラー時に適切なエラーメッセージが返る

---

## 2. Playwright MCPでの動作確認

### ブラウザでの統合テスト

```typescript
// Playwright MCPを使用してブラウザ操作

// 1. ページを開く
await mcp__playwright__browser_navigate({ url: "http://localhost:5173" })

// 2. スナップショットで現在の状態を確認
await mcp__playwright__browser_snapshot({})

// 3. 要素をクリック
await mcp__playwright__browser_click({
  element: "チャット入力欄",
  ref: "[data-testid='chat-input']"
})

// 4. テキスト入力
await mcp__playwright__browser_type({
  element: "チャット入力欄",
  ref: "[data-testid='chat-input']",
  text: "収益認識について教えて"
})

// 5. 送信ボタンクリック
await mcp__playwright__browser_click({
  element: "送信ボタン",
  ref: "[data-testid='send-button']"
})

// 6. レスポンスを待って確認
await mcp__playwright__browser_wait_for({ text: "収益認識" })
await mcp__playwright__browser_snapshot({})
```

### 動作確認フロー

1. **論点マップ表示確認**
   - `/subjects` にアクセス
   - 科目一覧が表示されることを確認
   - 科目をクリック → カテゴリ一覧表示
   - カテゴリをクリック → 論点一覧表示

2. **チャット機能確認**
   - 論点詳細ページにアクセス
   - チャット入力欄にテキスト入力
   - 送信ボタンクリック
   - ストリーミングでレスポンスが表示されることを確認

3. **画像アップロード確認**
   - 画像選択ボタンをクリック
   - ファイルを選択
   - プレビュー表示を確認
   - 送信 → OCR結果が反映されることを確認

---

## 3. ユニットテスト

```bash
pnpm --filter @cpa-study/api test

# 特定ファイル
pnpm --filter @cpa-study/api test src/features/chat/usecase.test.ts

# watchモード
pnpm --filter @cpa-study/api test --watch
```

### UseCase（依存注入でモック）

```typescript
// features/chat/usecase.test.ts
import { describe, test, expect, vi } from "vitest"
import { sendMessage } from "./usecase"
import { createMockAdapter } from "@/shared/lib/ai/adapters/mock"

describe("sendMessage", () => {
  test("returns streamed response", async () => {
    const mockRepo = {
      findSession: vi.fn().mockResolvedValue({ id: "session-1", topicId: "topic-1" }),
      saveMessage: vi.fn(),
    }
    const mockAI = createMockAdapter()

    const stream = await sendMessage(
      { chatRepo: mockRepo, aiAdapter: mockAI },
      { sessionId: "session-1", content: "質問" }
    )

    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    expect(chunks.some((c) => c.type === "text")).toBe(true)
    expect(chunks.at(-1)?.type).toBe("done")
  })
})
```

---

## 4. カスタムモックレスポンス

```typescript
// 特定のパターンに対するレスポンスを設定
import { createMockAdapter } from "@/shared/lib/ai/adapters/mock"

const customMock = createMockAdapter([
  {
    pattern: /収益認識/,
    response: "収益認識の5ステップモデルについて説明します...",
    delay: 50,
  },
  {
    pattern: /エラーテスト/,
    response: "ERROR: テスト用エラー",
    delay: 0,
  },
])
```

---

## 検証完了基準

実装完了時に以下を満たすこと:

- [ ] すべてのエンドポイントがcurlで正常レスポンスを返す
- [ ] Playwright MCPでUI操作が正常に動作する
- [ ] ユニットテストがすべてパスする
- [ ] エラーケースでも適切なレスポンスが返る
