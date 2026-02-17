# ADR: ステージング/本番環境でのログ保存方式

**日付**: 2026-02-13
**ステータス**: 廃止 → [20260215_remove_tail_worker.md](./20260215_remove_tail_worker.md) に置き換え

## コンテキスト

構造化ログ（JSON形式の `console.log` 出力）を導入済み。ステージング/本番環境でこのログを収集・保存・可視化する仕組みが必要。

### 要件

- Cloudflare Workers Free Planの範囲内で運用したい
- ログを収集・保存し、後から検索・集計できるようにしたい
- メインAPIのパフォーマンスに影響を与えない

## 検討した選択肢

### A. 自前Worker + D1

```
Main API → fetch → Log Worker → D1保存
Dashboard Worker → D1読み取り → UI表示
```

- メリット: 全て自前で制御可能、SQLで柔軟にクエリ
- デメリット: メインAPIに**レイテンシ追加**（subrequest）、D1はappend-heavyなワークロードに最適ではない、ダッシュボードUIのフルスクラッチ開発が必要

### B. Tail Worker + D1

```
Main API → console.log(JSON) → [非同期] Tail Worker → D1保存
```

- メリット: メインAPIへの影響ゼロ、D1で柔軟なクエリ
- デメリット: ダッシュボードUIのフルスクラッチ、D1のログ向け性能

### C. Tail Worker + Workers Analytics Engine (WAE) ← 採用

```
Main API → console.log(JSON) → [非同期] Tail Worker → WAE書き込み
Dashboard → WAE SQL API → 集計・可視化
```

- メリット: メインAPIへの影響ゼロ、WAEはログ/メトリクス集計に最適化、SQL APIで集計可能、無料
- デメリット: WAEはリテンション制限あり（Free: 90日、有料ではない場合もあり）、細かいログ検索はD1向き

### D. 外部SaaS (Better Stack, Datadog等)

- メリット: ダッシュボード不要、アラート機能組み込み
- デメリット: 無料枠の制約、外部依存

## 決定

**選択肢C: Tail Worker + Workers Analytics Engine** を採用。

### アーキテクチャ

```
┌─────────────┐     console.log(JSON)     ┌──────────────┐      WAE API
│  Main API   │ ─────────────────────────> │  Tail Worker  │ ──────────────> WAE Dataset
│  Worker     │       (非同期)              │              │                 "api_logs"
└─────────────┘                            └──────────────┘
```

WAE SQL API を使えば、後からダッシュボードやSlack通知等を追加することも可能。

### Tail Worker の責務

1. **ログ解析**: `console.log` のJSON文字列をパースし、WAEのデータポイントに変換
2. **WAE書き込み**: `LOGS.writeDataPoint()` でデータセット `api_logs` に書き込み

### WAE データポイント設計（案）

```typescript
LOGS.writeDataPoint({
  blobs: [
    level,       // "info" | "warn" | "error"
    msg,         // "Response sent"
    requestId,   // "ca77e644"
    method,      // "GET"
    path,        // "/api/auth/me"
    feature,     // "auth" | "chat" | ...
    errorMsg,    // エラー時のメッセージ（任意）
  ],
  doubles: [
    status,      // 200, 401, 500...
    duration,    // レスポンスタイム(ms)
  ],
  indexes: [
    level,       // 検索用インデックス
  ],
})
```

### インフラ定義

Terraform（`infra/main.tf`）:

```hcl
# Tail Worker用のスクリプト定義（実際のデプロイはwrangler経由）
# wrangler.toml で tail_consumers / analytics_engine_datasets を定義
```

`apps/api/wrangler.toml`:

```toml
[[tail_consumers]]
service = "cpa-study-tail-worker"
```

Tail Worker側の `wrangler.toml`:

```toml
name = "cpa-study-tail-worker"
main = "src/index.ts"

[[analytics_engine_datasets]]
binding = "LOGS"
dataset = "api_logs"
```

### 無料枠の試算

1日1,000 APIリクエスト想定:

| リソース | 消費量/日 | 無料枠 | 余裕 |
|---------|----------|--------|------|
| Tail Worker invocations | 1,000 | 100,000/日 | 余裕 |
| WAE writes | ~3,000 | 制限なし（Free） | 余裕 |
| WAE reads (ダッシュボード) | ~数十 | 制限なし（Free） | 余裕 |

## 実装ステップ

1. Tail Worker プロジェクトの作成（`apps/tail-worker/`）
2. WAE バインディング設定
3. ログパース → WAE書き込みの実装
4. Terraform / wrangler.toml の更新
