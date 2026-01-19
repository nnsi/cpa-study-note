# 回答について

中立・客観的な回答を心掛ける。ユーザーの言うことを鵜吞みにせず、迎合もしないこと。

---

# プロジェクト: 公認会計士学習サポートアプリ

## 技術スタック

| 領域 | 技術 |
|-----|------|
| フロントエンド | Vite + React + Tanstack Router |
| バックエンド | Hono on Cloudflare Workers |
| DB | Cloudflare D1 + Drizzle ORM |
| ストレージ | Cloudflare R2 |
| 認証 | Google OAuth（マルチプロバイダー対応設計） |
| AI | OpenRouter経由（DeepSeek-V3, Vision OCR） |
| UI | Tailwind CSS |
| 構成 | モノレポ（pnpm workspace） |

## アーキテクチャ方針

### バックエンド（Hono API）
- **クリーンアーキテクチャ**: Route → UseCase → Domain → Repository
- **Package by Feature**: `apps/api/src/features/{feature}/` に分離
- **関数型**: クラス不使用、純粋関数中心
- **Result型**: エラーは `Result<T, E>` で表現

### フロントエンド（React）
- **3層分離**: Logic / UI Hooks / Components
- **Logic**: 純粋関数、UIに依存しない
- **Hooks**: 状態管理、イベントハンドラ
- **Components**: propsを受け取り描画のみ

### 共有
- **Zodスキーマ**: `packages/shared/src/schemas/` で一元管理
- **型定義**: スキーマから推論（`z.infer<typeof schema>`）

## ディレクトリ構造

```
cpa-study-note/
├── packages/
│   ├── shared/              # 共有型定義 + Zodスキーマ
│   └── db/                  # Drizzle スキーマ + マイグレーション
├── apps/
│   ├── api/                 # Hono API (Cloudflare Workers)
│   │   └── src/features/    # auth, topic, chat, note, image
│   └── web/                 # React SPA
│       └── src/features/    # 機能別モジュール（3層分離）
└── docs/plan/               # 設計ドキュメント
```

## 開発用スキル

### コード生成
| スキル | 説明 |
|--------|------|
| `/hono-feature` | Hono APIのFeatureモジュール作成（DI + Hono RPC対応） |
| `/react-feature` | React Featureモジュール作成（3層分離 + Hono RPC + SSE対応） |
| `/drizzle-schema` | Drizzleテーブルスキーマを作成 |

### 開発・テスト
| スキル | 説明 |
|--------|------|
| `/check-types` | TypeScript型チェックとESLintを実行 |
| `/run-dev` | 開発サーバーを起動 |
| `/db-migrate` | Drizzleマイグレーションを生成・適用 |
| `/test-api` | APIテスト（モックAdapter使用、SSE対応） |

### ドキュメント・デプロイ
| スキル | 説明 |
|--------|------|
| `/lookup-docs` | Context7を使って技術ドキュメントを参照 |
| `/deploy-check` | デプロイ前のチェックリストを実行 |

## 重要な設計詳細

詳細は以下を参照:
- `docs/plan/summary.md` - 全体サマリ
- `docs/plan/backend.md` - バックエンド設計
- `docs/plan/frontend.md` - フロントエンド設計
- `docs/require.md` - 要件定義