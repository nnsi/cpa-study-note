# 回答について

中立・客観的な回答を心掛ける。ユーザーの言うことを鵜吞みにせず、迎合もしないこと。

---

# 開発ワークフローのルール

## 動作確認の徹底

- **書いたら即検証**: 機能実装後は必ず `curl` または Playwright MCP で動作確認する
- **「動くはず」を信じない**: 型エラーがなくても動作確認するまで完了と言わない
- **End-to-Endで確認**: 「APIが動く」「UIが表示される」ではなく「ユーザーが機能を使える」かを確認

## UI変更時のチェック

- **導線を確認**: 「この画面に来る導線」と「この画面から出る導線」の両方を確認
- **既存フローへの影響**: 追加した機能が既存のフローとどう噛み合うかを考える

## 品質管理

- **型エラーはゼロ**: 「既存のエラーだから」で済ませない
- **仮実装は即報告**: コメントに「一旦」「TODO」「方法が必要」等があれば要確認リストに入れる
- **チェックリストを形骸化させない**: チェックが入っていないタスクは本当に未完了
- **探索結果を鵜呑みにしない**: エージェントの結果は「本当に問題か」を自分で判断してからTodoに入れる

## レイヤー遵守

- バックエンドは `Route → UseCase → Repository` の依存方向を守る
- 単純なCRUDでも UseCase を経由する（「妥協」しない）

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
| `/ui-skills` | UIコンポーネント構築の制約（Tailwind、アクセシビリティ、アニメーション等） |

### コードレビュー・分析
| スキル | 説明 |
|--------|------|
| `/codex` | Codex CLIでコードレビュー・バグ調査・リファクタリング提案 |

### ドキュメント・デプロイ
| スキル | 説明 |
|--------|------|
| `/lookup-docs` | Context7を使って技術ドキュメントを参照 |
| `/deploy-check` | デプロイ前のチェックリストを実行 |
| `/write-diary` | /docs/diary/ に開発日記を記録 |

## 重要な設計詳細

詳細は以下を参照:
- `docs/plan/summary.md` - 全体サマリ
- `docs/plan/backend.md` - バックエンド設計
- `docs/plan/frontend.md` - フロントエンド設計
- `docs/require.md` - 要件定義