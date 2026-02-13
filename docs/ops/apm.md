# APM（パフォーマンス計測）運用ガイド

## 概要

リクエストごとの D1 / AI / R2 の処理時間内訳を自動計測し、Workers Analytics Engine (WAE) に蓄積している。

- **計測**: `tracer.span("d1.xxx", fn)` でラップされた処理の所要時間を自動記録
- **蓄積**: Tail Worker が "Response sent" / "Stream complete" / error ログを WAE に書き込む
- **参照**: WAE SQL API (curl) または Cloudflare Dashboard

## WAE スキーマ

dataset: `api_logs`

| 列 | フィールド | 内容 |
|----|-----------|------|
| blob1 | level | ログレベル (info / warn / error) |
| blob2 | msg | "Response sent" / "Stream complete" / エラーメッセージ |
| blob3 | requestId | リクエスト ID (8文字) |
| blob4 | method | HTTP メソッド |
| blob5 | path | リクエストパス |
| blob6 | feature | feature名 (chat / note 等) |
| blob7 | error | エラーメッセージ (エラー時のみ) |
| double1 | status | HTTP ステータスコード |
| double2 | duration | 総リクエスト時間 (ms) |
| double3 | d1Ms | D1 クエリ合計時間 (ms) |
| double4 | aiMs | AI 呼び出し合計時間 (ms) |
| double5 | r2Ms | R2 操作合計時間 (ms) |
| double6 | spanCount | 計測操作数 |
| index1 | level | ログレベル (フィルタ用) |

## CLI でのデータ確認

### 前提

```bash
# 環境変数をセット（.envrc 等に入れておくと便利）
export CF_ACCOUNT_ID="your-account-id"
export CF_API_TOKEN="your-api-token"
```

API トークンには `Account Analytics: Read` 権限が必要。

### エンドポイント別の平均レイテンシ

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d "
    SELECT
      blob5 AS path,
      count() AS requests,
      avg(double2) AS avg_duration,
      avg(double3) AS avg_d1,
      avg(double4) AS avg_ai,
      avg(double5) AS avg_r2
    FROM api_logs
    WHERE blob2 = 'Response sent'
      AND timestamp > NOW() - INTERVAL '1' HOUR
    GROUP BY path
    ORDER BY avg_duration DESC
  " | jq .
```

### 遅いリクエスト Top 10

ストリーミングエンドポイント (chat, topic-generator) の計測データは "Stream complete" に含まれるため、両方を対象にする。

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d "
    SELECT
      blob3 AS requestId,
      blob4 AS method,
      blob5 AS path,
      blob2 AS msg,
      double2 AS duration,
      double3 AS d1Ms,
      double4 AS aiMs,
      double5 AS r2Ms,
      double6 AS spanCount
    FROM api_logs
    WHERE blob2 IN ('Response sent', 'Stream complete')
      AND timestamp > NOW() - INTERVAL '1' HOUR
    ORDER BY double2 DESC
    LIMIT 10
  " | jq .
```

### Feature 別の AI 呼び出し時間

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d "
    SELECT
      blob6 AS feature,
      count() AS requests,
      avg(double4) AS avg_ai_ms,
      max(double4) AS max_ai_ms
    FROM api_logs
    WHERE blob2 IN ('Response sent', 'Stream complete')
      AND double4 > 0
      AND timestamp > NOW() - INTERVAL '1' HOUR
    GROUP BY feature
    ORDER BY avg_ai_ms DESC
  " | jq .
```

### エラー一覧

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d "
    SELECT
      blob3 AS requestId,
      blob5 AS path,
      blob6 AS feature,
      blob7 AS error,
      double1 AS status,
      double2 AS duration
    FROM api_logs
    WHERE index1 = 'error'
      AND timestamp > NOW() - INTERVAL '1' HOUR
    ORDER BY timestamp DESC
    LIMIT 20
  " | jq .
```

### ストリーミングエンドポイントの計測

SSE エンドポイント (chat, topic-generator) は middleware の "Response sent" とは別に、ストリーム終了時に "Stream complete" ログを出す。

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d "
    SELECT
      blob5 AS path,
      count() AS streams,
      avg(double4) AS avg_ai_ms,
      avg(double3) AS avg_d1_ms
    FROM api_logs
    WHERE blob2 = 'Stream complete'
      AND timestamp > NOW() - INTERVAL '1' HOUR
    GROUP BY path
  " | jq .
```

## Cloudflare Dashboard での確認

1. **Workers & Pages** > 対象 Worker > **Logs** タブ
   - リアルタイムでJSON構造化ログを閲覧可能
   - `"msg":"Response sent"` のログに `d1Ms`, `aiMs`, `r2Ms` が含まれる

2. **Workers & Pages** > 対象 Worker > **Analytics** タブ
   - リクエスト数、CPU時間、エラー率等の概要

## Tracer の使い方（開発者向け）

新しい feature や操作を計測する場合:

```typescript
// 自動計測（推奨）: async関数をラップ
const result = await deps.tracer.span("d1.findById", () =>
  deps.repo.findById(id)
)

// 手動計測: ストリーミング等でラップできない場合
const t0 = performance.now()
// ... streaming処理 ...
deps.tracer.addSpan("ai.stream", performance.now() - t0)
```

**span名のプレフィックス規約**:
- `d1.` — D1 データベース操作
- `ai.` — AI API 呼び出し
- `r2.` — R2 ストレージ操作
- その他のプレフィックスは `getSummary()` の集計対象外（spanCount にはカウントされる）

## 関連ドキュメント

- [APM 設計書](../feat/apm/design.md)
- [ログ運用ガイド](./log.md)
- [構造化ログ適用ガイド](../memo/logging-guide.md)
