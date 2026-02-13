# APM基盤導入（計測ログ蓄積のみ）

## Context

構造化JSONロガー + Tail Worker + WAE基盤は既にある。不足しているのは**D1/AI/R2の時間内訳を計測してWAEに蓄積する仕組み**。ダッシュボードは将来の管理画面で自作予定のため今回は対象外。

**ゴール**: リクエストごとのパフォーマンス内訳がWAEに貯まる状態を作る。検証はCF Dashboard + WAE SQL APIで行う。

---

## Phase 1: Tracer ユーティリティ + ロガー拡張

### 1-1. `apps/api/src/shared/lib/tracer.ts` 新規作成

```typescript
export type SpanData = { name: string; duration: number }

export type Tracer = {
  span: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  addSpan: (name: string, duration: number) => void  // ストリーミング等の手動記録用
  getSummary: () => { d1Ms: number; aiMs: number; r2Ms: number; spanCount: number }
}
```

- `span()` — async関数をラップして自動計測（`performance.now()`使用）
- `addSpan()` — ストリーミング等、`span()`でラップできないケース用
- `getSummary()` — `d1.`/`ai.`/`r2.` プレフィックスでカテゴリ別合計を返す
- テスト: `tracer.test.ts`

### 1-2. `apps/api/src/shared/types/env.ts` 修正

`Variables` に `tracer: Tracer` を追加。

### 1-3. `apps/api/src/shared/middleware/logger.ts` 修正

- リクエストごとに `createTracer()` → `c.set("tracer", tracer)`
- "Response sent" ログに計測サマリを追加:
  ```typescript
  const summary = tracer.getSummary()
  logger[level]("Response sent", { status, duration, ...summary })
  ```

**ストリーミング注意**: SSEでは `await next()` がストリーム開始で解決するため、AI streaming時間はusecase内で `tracer.addSpan()` で手動記録する。

---

## Phase 2: キーFeatureの計装

AI呼び出しのある6 featureに `tracer.span()` を適用:

| Feature | 計測対象 | 修正ファイル |
|---------|---------|-------------|
| chat | D1クエリ群 + AIストリーム | `usecase.ts`, `route.ts` |
| note | D1 + AI要約 | `usecase.ts`, `route.ts` |
| image | R2 + AI OCR | `usecase.ts`, `route.ts` |
| exercise | AI分析 | `usecase.ts`, `route.ts` |
| topic-generator | AI生成 | `usecase.ts`, `route.ts` |
| quick-chat | AI提案 | `usecase.ts`, `route.ts` |

**変更パターン**（各feature共通）:

route.ts: `c.get("tracer")` をdepsに追加
usecase.ts: Depsに `tracer: Tracer` 追加、操作を `tracer.span()` でラップ

```typescript
// Before (chat/usecase.ts の手動タイミング):
const t0 = performance.now()
const session = await deps.chatRepo.findSessionById(input.sessionId)
deps.logger.debug("Phase1 findSession", { duration: performance.now() - t0 })

// After:
const session = await deps.tracer.span("d1.findSessionById", () =>
  deps.chatRepo.findSessionById(input.sessionId)
)
```

---

## Phase 3: Tail Worker WAEスキーマ拡張

### `apps/tail-worker/src/index.ts` 修正

**LogEntry型に追加**:
```typescript
d1Ms?: number
aiMs?: number
r2Ms?: number
spanCount?: number
```

**WAE doubles拡張** (2→6):
```typescript
doubles: [
  entry.status ?? 0,      // double1: HTTPステータス（既存）
  entry.duration ?? 0,    // double2: 総リクエスト時間（既存）
  entry.d1Ms ?? 0,        // double3: D1合計時間 ← NEW
  entry.aiMs ?? 0,        // double4: AI合計時間 ← NEW
  entry.r2Ms ?? 0,        // double5: R2合計時間 ← NEW
  entry.spanCount ?? 0,   // double6: 操作数 ← NEW
]
```

**フィルタリング追加**: `msg === "Response sent"` / `msg === "Stream complete"` / `level === "error"` のみWAEに書き込む（debug/infoログ除外で書き込み量削減）。

---

## 修正ファイル一覧

### 新規
- `apps/api/src/shared/lib/tracer.ts`
- `apps/api/src/shared/lib/tracer.test.ts`

### 修正
- `apps/api/src/shared/types/env.ts`
- `apps/api/src/shared/middleware/logger.ts`
- `apps/api/src/features/chat/{usecase,route}.ts`
- `apps/api/src/features/note/{usecase,route}.ts`
- `apps/api/src/features/image/{usecase,route}.ts`
- `apps/api/src/features/exercise/{usecase,route}.ts`
- `apps/api/src/features/topic-generator/{usecase,route}.ts`
- `apps/api/src/features/quick-chat/{usecase,route}.ts`
- `apps/tail-worker/src/index.ts`

---

## 検証方法

1. **ローカル**: dev起動 → リクエスト → コンソールに `d1Ms`, `aiMs`, `r2Ms` 付き "Response sent" ログ確認
2. **WAEデータ確認**: デプロイ後、WAE SQL APIで確認
   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/analytics_engine/sql" \
     -H "Authorization: Bearer {API_TOKEN}" \
     -d "SELECT blob5 AS path, avg(double2) AS avg_duration, avg(double3) AS avg_d1, avg(double4) AS avg_ai FROM api_logs WHERE blob2 = 'Response sent' AND timestamp > NOW() - INTERVAL '1' HOUR GROUP BY path"
   ```
3. **テスト**: `pnpm --filter api test` + `pnpm --filter shared test` + `pnpm --filter web test` 全パス
