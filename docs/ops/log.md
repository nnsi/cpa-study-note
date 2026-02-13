# ログ運用ガイド

## 概要

API (Hono on Cloudflare Workers) は構造化JSONロガーで全リクエストのログを出力する。ログは2つの経路で確認できる:

1. **Workers Logs** — Cloudflare Dashboard またはリアルタイムtail (wrangler)
2. **WAE (Workers Analytics Engine)** — SQL API でクエリ（Tail Worker 経由で蓄積）

## ログフォーマット

全ログは1行JSONで出力される:

```json
{
  "level": "info",
  "msg": "Response sent",
  "requestId": "a1b2c3d4",
  "method": "GET",
  "path": "/api/subjects",
  "status": 200,
  "duration": 45,
  "d1Ms": 12,
  "aiMs": 0,
  "r2Ms": 0,
  "spanCount": 2,
  "timestamp": "2026-02-13T01:34:36.484Z"
}
```

### フィールド説明

| フィールド | 説明 |
|-----------|------|
| level | `debug` / `info` / `warn` / `error` |
| msg | ログメッセージ |
| requestId | リクエスト単位の追跡ID (8文字) |
| method | HTTP メソッド |
| path | リクエストパス |
| feature | feature名 (`child({ feature })` で付与) |
| status | HTTP ステータスコード |
| duration | 総リクエスト時間 (ms) |
| d1Ms / aiMs / r2Ms | APM 内訳 (ms)。[APM ガイド](./apm.md) 参照 |
| error | エラーメッセージ (エラー時のみ) |

### リクエストライフサイクルのログ

1つのリクエストで通常2つのログが出る:

```
{"level":"info","msg":"Request received","requestId":"a1b2c3d4",...}
{"level":"info","msg":"Response sent","requestId":"a1b2c3d4","status":200,"duration":45,...}
```

SSE ストリーミングの場合は追加で:

```
{"level":"info","msg":"Stream complete","requestId":"a1b2c3d4","feature":"chat","d1Ms":15,"aiMs":1200,...}
```

## wrangler tail でリアルタイム確認

### 基本

```bash
# API Worker のログをリアルタイム表示
wrangler tail cpa-study-api-stg

# 本番
wrangler tail cpa-study-api-prod
```

### フィルタ付き

```bash
# エラーのみ
wrangler tail cpa-study-api-stg --status error

# 特定パスのみ (JSON出力 + jq でフィルタ)
wrangler tail cpa-study-api-stg --format json | jq 'select(.logs[].message[] | contains("/api/chat"))'
```

### Tail Worker のログ

```bash
# Tail Worker 自体のログ（WAE書き込みの確認用）
wrangler tail cpa-study-tail-worker-stg
```

## Cloudflare Dashboard での確認

### Workers Logs

1. **Workers & Pages** > Worker を選択 > **Logs** タブ
2. **Begin log stream** をクリック
3. リアルタイムでリクエストログが表示される

フィルタ:
- Status code でフィルタ可能 (4xx, 5xx)
- Search でパス名やエラーメッセージを検索

### Workers Analytics

1. **Workers & Pages** > Worker を選択 > **Analytics** タブ
2. 概要:
   - Requests: リクエスト数の推移
   - CPU Time: Worker の CPU 使用時間
   - Duration: リクエスト処理時間
   - Errors: エラー率

## WAE SQL API での分析

WAE に蓄積されたログを SQL で分析する。詳細なクエリ例は [APM ガイド](./apm.md) を参照。

### 基本クエリ

```bash
export CF_ACCOUNT_ID="your-account-id"
export CF_API_TOKEN="your-api-token"

# 直近1時間のリクエスト数をパス別に集計
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d "
    SELECT
      blob5 AS path,
      count() AS requests,
      avg(double2) AS avg_duration
    FROM api_logs
    WHERE blob2 = 'Response sent'
      AND timestamp > NOW() - INTERVAL '1' HOUR
    GROUP BY path
    ORDER BY requests DESC
  " | jq .
```

### エラーログの確認

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d "
    SELECT
      blob3 AS requestId,
      blob5 AS path,
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

## ローカル開発時のログ確認

```bash
pnpm --filter api dev
```

コンソールに JSON ログが出力される。`jq` でフォーマットする場合:

```bash
# Windowsの場合、別ターミナルでdev起動後にcurlで確認
curl -s http://localhost:8787/api/subjects \
  -H "X-Dev-User-Id: test-user-1" | jq .
```

dev サーバーの stdout に以下のようなログが出力される:

```
{"level":"info","msg":"Request received","requestId":"ff405c76","method":"GET","path":"/api/subjects"}
{"level":"info","msg":"Response sent","requestId":"ff405c76","status":200,"duration":12,"d1Ms":8,"aiMs":0,"r2Ms":0,"spanCount":1}
```

## ログレベルの使い分け

| レベル | 用途 | WAE蓄積 |
|--------|------|---------|
| `error` | 処理失敗（ユーザーにエラーが返る） | あり |
| `warn` | 異常だが処理続行（フォールバック等） | なし |
| `info` | 正常な業務イベント（Request/Response） | "Response sent" / "Stream complete" のみ |
| `debug` | 開発用詳細情報（中間状態のダンプ等） | なし |

Tail Worker のフィルタにより WAE に書き込まれるのは:
- `msg === "Response sent"`
- `msg === "Stream complete"`
- `level === "error"`

## 関連ドキュメント

- [APM 運用ガイド](./apm.md)
- [構造化ログ適用ガイド](../memo/logging-guide.md)（開発者向け実装手順）
- [ログ蓄積設計 ADR](../adr/20260213_log_storage_production.md)
