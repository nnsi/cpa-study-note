# ADR: Tail Worker廃止 → メインWorker内WAE直書き

**日付**: 2026-02-15
**ステータス**: 承認済み
**前提ADR**: `20260213_log_storage_production.md`（本ADRにより置き換え）

## コンテキスト

構造化ログの保存方式として「Tail Worker + WAE」を採用・実装済みだったが、**Tail WorkerはCloudflare Workers有料プラン（$5/月〜）でのみ利用可能**であることが判明。Free Planの範囲内で運用する要件を満たさない。

### 変更前のアーキテクチャ

```
Main API → console.log(JSON) → [非同期] Tail Worker → WAE "api_logs"
```

- Tail Workerが`console.log`出力を非同期に受信
- JSONパース → `shouldWrite`フィルタ → `writeDataPoint`でWAEに書き込み
- 別Workerとしてデプロイ・管理が必要

## 検討した選択肢

### A. 有料プランに移行してTail Workerを維持

- メリット: 既存実装をそのまま使える
- デメリット: $5/月のコスト増、個人学習アプリには過剰

### B. メインWorkerで`waitUntil` + WAE直書き

- メリット: Free Planで動作、Worker数削減
- デメリット: `waitUntil`にExecutionContextの受け渡しが必要

### C. Logger `onWrite`コールバック + WAE直書き ← 採用

- メリット: Free Planで動作、Worker数削減、`waitUntil`不要（`writeDataPoint`は同期API）、インフラ都合をアプリケーション層に漏らさない
- デメリット: ログ書き込みがメインWorkerのリクエスト処理内で実行される（ただし`writeDataPoint`は同期fire-and-forgetなのでブロックしない）

## 決定

**選択肢C: Logger `onWrite`コールバック + WAE直書き** を採用。

### 変更後のアーキテクチャ

```
Main API → Logger.write() → console.log(JSON)        ← デバッグ用（wrangler tail）
                           → onWrite(entry)           ← WAE書き込み
                             └→ shouldWriteToWAE()
                               └→ writeToWAE(LOGS, entry)
```

### 設計のポイント

**1. `onWrite`コールバックでインフラ関心を分離**

```typescript
// logger.ts - WAEの存在を知らない
const write = (level, msg, data) => {
  const entry = { level, msg, ...bindings, ...data }
  console.log(JSON.stringify(entry))
  onWrite?.(entry)  // コールバック呼び出し
}
```

```typescript
// loggerMiddleware - インフラバインディングとの接続点
const logger = createLogger({
  bindings: { requestId, method, path },
  onWrite: logs ? (entry) => {
    if (shouldWriteToWAE(entry)) writeToWAE(logs, entry)
  } : undefined,
})
```

**2. child loggerへの`onWrite`継承**

`logger.child({ feature: "chat" })`で生成された子ロガーにも`onWrite`が引き継がれるため、usecase層で`logger.info("Stream complete", ...)`を呼んだ際もWAEに到達する。

**3. `waitUntil`が不要な理由**

`AnalyticsEngineDataset.writeDataPoint()`は同期的なfire-and-forget API（戻り値`void`）。Workers runtimeが非同期に処理するため、メインスレッドをブロックしない。SSEストリーミング中もWorkerは生存しているため、ストリーム完了時の書き込みも問題なく実行される。

### WAEスキーマ（変更なし）

Tail Worker時代と同一のスキーマを維持。既存のSQLクエリはそのまま動作する。

## 影響範囲

| 対象 | 変更内容 |
|------|---------|
| `apps/api/src/shared/lib/logger.ts` | `onWrite`コールバック追加、child loggerへの継承 |
| `apps/api/src/shared/lib/wae.ts` | **新規** - Tail Workerから移植した`shouldWriteToWAE` + `writeToWAE` |
| `apps/api/src/shared/middleware/logger.ts` | `c.env.LOGS`があれば`onWrite`でWAE書き込み |
| `apps/api/src/shared/types/env.ts` | `LOGS?: AnalyticsEngineDataset` 追加 |
| `apps/api/wrangler.toml` | `tail_consumers` → `analytics_engine_datasets`（全環境） |
| `.github/workflows/deploy.yml` | `deploy-tail-worker`ジョブ削除 |
| `apps/tail-worker/` | ディレクトリ削除 |

## 運用対応

- Cloudflareダッシュボードから既存Tail Worker（`cpa-study-tail-worker-stg` / `cpa-study-tail-worker-prod`）を手動削除する
- WAE dataset `api_logs` は既存のものが継続利用される
- `docs/ops/apm.md` のSQLクエリは変更不要
