---
name: react-feature
description: React Featureモジュールを3層分離アーキテクチャで作成する
---

# React Feature モジュール作成

フロントエンドのFeatureモジュールをLogic/Hooks/Components 3層 + Hono RPCで作成する。

## 重要: UIデザインの原則

**UIコンポーネント実装時は `/ui-skills` を適用すること。**

主要ルール:
- Tailwind CSSデフォルト値を使用
- `cn` ユーティリティ（clsx + tailwind-merge）でクラス結合
- アクセシブルなプリミティブ（Base UI, React Aria, Radix）を使用
- `h-screen` ではなく `h-dvh` を使用
- アニメーションは明示的に要求された場合のみ
- グラデーション、グロー効果は使用しない

詳細は `/ui-skills` スキルを参照。

---

## 重要: 実装後の検証

**Feature実装後は必ず以下を確認すること:**

1. **Playwright MCPでブラウザ上の動作を確認**
2. **各UIコンポーネントが正しく表示されるか確認**
3. **APIとの連携が正常に動作するか確認**
4. **レスポンシブ対応（モバイル/タブレット/PC）を確認**
5. **`/ui-skills` の制約に違反していないか確認**

詳細は `/test-api` スキルを参照。

## ディレクトリ構造

```
apps/web/src/features/{feature-name}/
├── index.ts           # 公開APIのエクスポート
├── logic.ts           # 純粋なビジネスロジック
├── hooks.ts           # UI Hooks（状態管理）
├── api.ts             # API呼び出し（Hono RPC）
├── types.ts           # Feature固有の型（必要なら）
└── components/
    ├── index.ts
    ├── {FeatureName}Container.tsx  # Hooksを使用するContainer
    └── {FeatureName}View.tsx       # 純粋なUI
```

## 3層分離の原則

| レイヤー | 役割 | 特徴 |
|---------|------|------|
| Logic | 純粋なビジネスロジック | UIに依存しない、テスト容易 |
| UI Hooks | 状態管理・イベントハンドラ | Reactに依存、副作用を含む |
| Component | 純粋なUI | propsを受け取り描画のみ |

## テンプレート

### api.ts（Hono RPC使用）
```typescript
import { api } from "@/lib/api-client"
import type { StreamChunk } from "@cpa-study/shared/types"

// 型安全なAPI呼び出し（エンドポイント・パラメータ・レスポンスすべて型補完）
export const getList = async () => {
  const res = await api.api.{featureName}.$get()
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

export const getById = async (id: string) => {
  const res = await api.api.{featureName}[":id"].$get({
    param: { id },
  })
  if (!res.ok) throw new Error("Not found")
  return res.json()
}

export const create = async (data: Create{FeatureName}Input) => {
  const res = await api.api.{featureName}.$post({
    json: data,
  })
  if (!res.ok) throw new Error("Failed to create")
  return res.json()
}
```

### api.ts（SSEストリーミング対応）
```typescript
import { api } from "@/lib/api-client"
import type { StreamChunk } from "@cpa-study/shared/types"

// SSEストリーミングの消費
export async function* stream{FeatureName}(
  id: string,
  input: {FeatureName}Input
): AsyncIterable<StreamChunk> {
  const res = await api.api.{featureName}[":id"].stream.$post({
    param: { id },
    json: input,
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

### logic.ts
```typescript
// 純粋関数のみ（副作用なし）
export const filterBy{Criteria} = (
  items: {ItemType}[],
  criteria: string
): {ItemType}[] => items.filter((item) => item.{field} === criteria)

export const calculate{Something} = (data: Data) => {
  // 計算ロジック
}

export const format{FeatureName}ForDisplay = (items: {ItemType}[]) =>
  items.map((item) => ({
    ...item,
    formattedDate: new Date(item.createdAt).toLocaleDateString(),
  }))
```

### hooks.ts
```typescript
import { useState, useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as api from "./api"
import * as logic from "./logic"

// データ取得Hook
export const use{FeatureName}List = () => {
  const { data = [], ...query } = useQuery({
    queryKey: ["{feature-name}"],
    queryFn: api.getList,
  })

  // Logicを使って派生データを計算
  const displayData = logic.format{FeatureName}ForDisplay(data)

  return { data, displayData, ...query }
}

// フォームHook
export const use{FeatureName}Form = () => {
  const [value, setValue] = useState("")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: api.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["{feature-name}"] })
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!value.trim()) return
    await mutation.mutateAsync({ value })
    setValue("")
  }, [value, mutation])

  return {
    value,
    setValue,
    isSubmitting: mutation.isPending,
    error: mutation.error,
    handleSubmit,
  }
}

// ストリーミングHook
export const use{FeatureName}Stream = (id: string) => {
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)

  const startStream = useCallback(async (input: {FeatureName}Input) => {
    setStreamingText("")
    setIsStreaming(true)

    try {
      for await (const chunk of api.stream{FeatureName}(id, input)) {
        if (chunk.type === "text" && chunk.content) {
          setStreamingText((prev) => prev + chunk.content)
        }
        if (chunk.type === "error") {
          throw new Error(chunk.error)
        }
      }
    } finally {
      setIsStreaming(false)
    }
  }, [id])

  return { streamingText, isStreaming, startStream }
}
```

### components/{FeatureName}View.tsx
```typescript
// 純粋なUI（状態を持たない）
type Props = {
  data: DisplayData[]
  isLoading: boolean
  onAction: () => void
}

export const {FeatureName}View = ({ data, isLoading, onAction }: Props) => {
  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.id} className="p-4 border rounded">
          {/* UIのみ */}
        </div>
      ))}
    </div>
  )
}
```

### components/{FeatureName}Container.tsx
```typescript
import { use{FeatureName}List } from "../hooks"
import { {FeatureName}View } from "./{FeatureName}View"

// Container: Hooksを呼び出し、純粋なUIに渡す
export const {FeatureName}Container = () => {
  const { displayData, isLoading, ...handlers } = use{FeatureName}List()

  return (
    <{FeatureName}View
      data={displayData}
      isLoading={isLoading}
      {...handlers}
    />
  )
}
```

### index.ts
```typescript
// 公開API
export { {FeatureName}Container } from "./components/{FeatureName}Container"
export { use{FeatureName}List, use{FeatureName}Form } from "./hooks"
```

## レスポンシブ対応

| ブレークポイント | 幅 | レイアウト |
|-----------------|-----|-----------|
| sm | ~639px | モバイル（タブ式、ボトムナビ） |
| md | 640~1023px | タブレット（サイドバー折りたたみ） |
| lg | 1024px~ | PC（2カラム、サイドバー常時表示） |

## Routeでの使用

```typescript
// routes/{feature-name}/index.tsx
import { createFileRoute } from "@tanstack/react-router"
import { {FeatureName}Container } from "@/features/{feature-name}"

export const Route = createFileRoute("/{feature-name}/")({
  component: {FeatureName}Page,
})

function {FeatureName}Page() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{FeatureName}</h1>
      <{FeatureName}Container />
    </div>
  )
}
```
