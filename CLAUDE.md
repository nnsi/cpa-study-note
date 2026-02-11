# 回答について

中立・客観的な回答を心掛ける。ユーザーの言うことを鵜吞みにせず、迎合もしないこと。

- **設計の異論は黙らず言う**: 別の案が良いと思ったなら理由を述べて議論する。「ユーザーが選んだから」で済ませない
- **気づいた問題は依頼がなくても報告する**: ドキュメントの記載が古い、設定と実態が乖離している等、作業中に気づいた問題は指摘する
- **スコープ外でもリスクがあれば提言する**: 「今回のタスクではないが、これは早めに対応した方がいい」と思ったら伝える

---

# 開発ワークフローのルール

## 基本原則

- **書いたら即検証**: 型エラーがなくても `curl` + ブラウザで動作確認するまで完了と言わない
- **型アサーションを避ける**: `as T` より Zodバリデーション。必要と思ったら設計を疑う
- **仮実装は即報告**: TODO・一旦等のコメントがあれば要確認リストに入れる
- **既存資産を活用**: 新APIを作る前に既存APIで実現できないか確認する
- **実装前に既知の落とし穴を確認**: `docs/memo/development-rules.md` を読み、関連する既知の問題がないか確認してから着手する

## アーキテクチャ

- バックエンド: `Route → UseCase → Repository`（単純CRUDでもUseCase経由）
- フロントエンド: Logic / UI Hooks / Components の3層分離
- 共有Zodスキーマ: `packages/shared/src/schemas/` で一元管理
- エラー表現: `Result<T, E>` 型

## インフラ操作

- D1・R2等はTerraform管理。`wrangler d1 delete/create` で直接操作しない
- `wrangler.toml` の `database_id` 等はプレースホルダー。固定値をコミットしない
- リソース削除前に `infra/*.tf` を確認

## テスト実行

- `pnpm --filter <package> test` を使う（`vitest run` を直接叩かない）
- 各パッケージのvitest.configに環境設定（happy-dom等）が紐づいているため、直接実行すると環境が適用されずテストが壊れる
- **修正後は影響範囲だけでなく全パッケージのテストを実行する**: API変更がフロントやsharedに影響する可能性があるため、必ず `web`, `api`, `shared` 全てを回す

```bash
pnpm --filter web test                    # web全テスト
pnpm --filter web test -- src/path/to.test.ts  # 指定ファイル
pnpm --filter api test                    # api全テスト
pnpm --filter shared test                 # shared全テスト
```

## コード探索

- 定義元→`goToDefinition`、影響範囲→`findReferences`、型情報→`hover`
- grepは文字列リテラル・コメント・設定値・正規表現パターンの検索に使う

## サブエージェント・Agent Team

- 画像を含む出力はサブエージェントに委譲してコンテキスト節約
- インターフェース（型定義、設計ルール）を厳密に指定して委譲
- Agent Team活用条件: 並列レビュー、独立機能3つ以上、大規模実装。詳細は `docs/memo/how-to-use-agent-team.md`
- 原則「**実装は直列、レビュー・分析は並列**」

---

# プロジェクト: InkTopik

学習領域（公認会計士試験等）を選択し、論点単位で学習の痕跡を残すアプリ。

| 領域 | 技術 |
|-----|------|
| FE | Vite + React + Tanstack Router + Tailwind CSS |
| BE | Hono on Cloudflare Workers |
| DB | Cloudflare D1 + Drizzle ORM |
| AI | OpenRouter経由（Gemini 2.5 Flash, Qwen3-8B, GPT-4o mini） |
| 構成 | モノレポ（pnpm workspace） |

設計詳細: `docs/plan/summary.md`, `docs/plan/backend.md`, `docs/plan/frontend.md`
