# 回答について

中立・客観的な回答を心掛ける。ユーザーの言うことを鵜吞みにせず、迎合もしないこと。

---

# 開発ワークフローのルール

## 動作確認の徹底

- **書いたら即検証**: 機能実装後は必ず `curl` または Playwright MCP で動作確認する
- **「動くはず」を信じない**: 型エラーがなくても動作確認するまで完了と言わない
- **End-to-Endで確認**: 「APIが動く」「UIが表示される」ではなく「ユーザーが機能を使える」かを確認
- **curlとブラウザ両方で確認**: curlで動いてもブラウザで動くとは限らない（CORS、Cookie、認証の組み合わせ）
- **現実的なデータサイズでテスト**: 小さなテストデータだけでなく、数MBの画像など実際のユースケースを想定

## APIエラーのデバッグ

- **ログ確認**: ローカル環境ではAPIサーバーがリクエスト/レスポンス/エラーの詳細ログをコンソールに出力
- **ログファイル**: `pnpm --filter api dev:log` でログを `apps/api/logs/api.log` に保存
- **エラー詳細**: 500エラー時はスタックトレース、cause、リクエストパスを出力
- **ログフォーマット**: `[ISO日時] --> METHOD /path` (リクエスト), `[ISO日時] <-- METHOD /path STATUS DURATIONms` (レスポンス)

## UI変更時のチェック

- **導線を確認**: 「この画面に来る導線」と「この画面から出る導線」の両方を確認
- **既存フローへの影響**: 追加した機能が既存のフローとどう噛み合うかを考える

## 品質管理

- **型エラーはゼロ**: 「既存のエラーだから」で済ませない
- **型アサーションを避ける**: `as T` より Zodバリデーションや `res.json<T>()` で型を確定させる
- **型アサーションが必要と思ったら設計を疑う**: 型を見直せばアサーションなしで解決できることが多い
- **「仕方ない」と思ったら自問する**: 本当に仕方ないのか？別の方法はないか？
- **仮実装は即報告**: コメントに「一旦」「TODO」「方法が必要」等があれば要確認リストに入れる
- **チェックリストを形骸化させない**: チェックが入っていないタスクは本当に未完了
- **探索結果を鵜呑みにしない**: エージェントの結果は「本当に問題か」を自分で判断してからTodoに入れる
- **反省点として認識したら即修正**: 「後で直す」は放置の言い訳。リリースブロッカーかどうか判断する

## 見積もりの精度

- **「大規模だからスキップ」と言う前に**: 実際の変更ファイル数・行数を確認する
- **既存実装の設計意図を理解する**: 「リフレッシュトークンテーブル＝セッション管理」のように、既存コードが持つ役割を把握する
- **実績ある構成を優先**: 同様の実装が他プロジェクトにあるなら、まずそれを確認して合わせる

## セキュリティ

- **プロンプトインジェクション対策はデフォルト**: AIチャット機能では最初からシステムプロンプトの先頭にセキュリティ指示を配置
- **環境変数は「漏れない構造」**: 「漏れても大丈夫」ではなく、本番に漏れた時の影響を最優先で考える
- **入力バリデーションは明示的に**: 文字列長、ファイル形式、配列サイズをZodで制限
- **複数視点でレビュー**: Exploreエージェント + Codex + ペネトレーションテストの組み合わせ

## サブエージェント活用

- **出力が大きいツールは委譲**: Playwright MCPなど画像を含む結果はサブエージェントに任せてコンテキストを節約
- **進捗確認は能動的に**: サブエージェントの完了通知を待つだけでなく、`TaskOutput`や`Read`で状態を確認
- **依頼は最後まで確認**: 「AとB両方」と言われたら両方実行する
- **インターフェースを厳密に指定**: サブエージェントに委譲する際は、レスポンス形式、型定義、設計ルール（Route→UseCase→Repository）を明示的に伝える
- **並列実行は依存関係を整理してから**: 依存のないタスクを先に特定し、同時に投げる

## レイヤー遵守

- バックエンドは `Route → UseCase → Repository` の依存方向を守る
- 単純なCRUDでも UseCase を経由する（「妥協」しない）
- 新しいルートを作る時は、同様の既存ルートがどう構成されているか先に確認する

## 設計思考

- **追加機能で問題を回避しようとしていないか**: 検索やブックマークで「5クリック問題」を回避するより、メインの導線を改善する方が本質的
- **ユーザーのメンタルモデルを優先**: 「学習タブ」をクリックする人は学習したい、編集したいわけではない
- **シンプルな解決策を最初に検討**: 「タブを追加」「メニューを作成」の前に「リンクを1つ置く」で済まないか考える
- **計画ファイルはdocs/配下に出力**: `.claude/plans/`は一時的、永続的な設計ドキュメントは`docs/`に置く
- **既存資産を活用**: 新APIを作る前に、既存APIで実現できないか確認する

## インフラ操作

- **IaC管理リソースは直接操作しない**: D1、R2等のCloudflareリソースはTerraformで管理。`wrangler d1 delete/create` で直接操作すると、Terraform stateと実リソースが乖離し復旧が困難になる
- **wrangler.tomlのIDはプレースホルダー**: `database_id`等はGitHub Actionsがデプロイ時に`vars.D1_DATABASE_ID`で置換する。固定値をコミットしない
- **DB初期化はテーブル単位で**: DBを削除せず、テーブルをDROPしてマイグレーションを再適用する。ただし`d1_migrations`テーブルも削除すること（履歴がないと再適用時に衝突）
- **リソース削除前にinfra/を確認**: `infra/*.tf` を見てIaC管理かどうか確認してから操作する

## 既知の落とし穴

以下は過去の開発で実際に発生した問題。同じミスを繰り返さないこと。

| 問題 | 原因 | 対策 |
|------|------|------|
| `Headers`オブジェクトがスプレッドで空になる | `{...headers}` は `Headers` クラスに効かない | `Object.fromEntries(headers.entries())` を使う |
| 大きな配列のスプレッドでスタックオーバーフロー | `String.fromCharCode(...hugeArray)` | チャンク処理（32KB単位など）で分割 |
| `credentials: 'include'` と `*` CORSが共存不可 | ブラウザのセキュリティポリシー | 動的にオリジンを返す |
| AIがJSONを ` ```json ``` ` で囲んで返す | LLMの出力フォーマットは不安定 | パース前にコードブロックを除去 |
| 開発モード認証バイパスでトークンフローが検証不能 | フロントエンドがAPIを経由しない | 開発用エンドポイントでも本番と同じフローを通す |
| セッション作成時に0件セッションが残る | 「作成」と「最初のメッセージ」が分離 | 最初のメッセージ送信時にセッション作成 |
| SQLiteマイグレーションでカラムが消える | テーブル再作成時に既存カラムを含め忘れ | CREATE TABLE文に全カラムを明示的に列挙 |
| dev-loginで外部キー制約違反 | 存在しないユーザーIDでトークン保存 | ユーザーが存在しない場合は自動作成 |
| IaC管理のD1を`wrangler d1 delete`で削除 | Terraform管理を確認せず直接操作 | `infra/*.tf`を確認し、IaC管理ならTerraform経由で操作 |
| CIでマイグレーション衝突 | `--file`で直接SQLを実行し`d1_migrations`に履歴が残らない | `wrangler d1 migrations apply`を使うか、履歴テーブルも含めて初期化 |
| wrangler.tomlにdatabase_id固定値 | GitHub Actionsで置換されるプレースホルダーを上書き | `YOUR_STAGING_DATABASE_ID`等のプレースホルダーを維持 |
| D1でBEGIN TRANSACTIONエラー | D1はSQL形式のトランザクションをサポートしない | `createNoTransactionRunner`を使うか、`db.batch()`で原子性を確保 |
| 生SQLでタイムスタンプ比較がマッチしない | Drizzle `mode: "timestamp"` は秒単位、JSは`getTime()`でミリ秒 | Drizzleクエリビルダーを使うか、`Math.floor(ts / 1000)`で変換 |
| `form_input`でReactの状態が更新されない | DOMの値を直接設定してもReactのonChangeは発火しない | `type`アクションを使うか、JavaScriptで直接操作 |
| Codexがシンタックスエラーを誤検出 | PowerShell経由でUTF-8日本語コメントが文字化け | 型チェックとテストが通っていればそちらを信頼 |
| Hono RPCがあるのに独自fetch実装 | 「raw bodyが必要」という思い込み | JSONで`{ content: string }`を送れば良い。一貫性を保つ |
| デフォルト値ロジックがDBと不整合 | `DEFAULT_STUDY_DOMAIN_ID`とDBの実際のIDが違う | フロントエンドから明示的にIDを渡す設計の方が堅牢 |

---

# プロジェクト: InkTopik（汎用学習サポートアプリ）

「論点に残す、あとから効く」をコンセプトにした学習記録アプリ。
学習領域（公認会計士試験、簿記など）を選択し、論点単位で学習の痕跡を残す。

## 技術スタック

| 領域 | 技術 |
|-----|------|
| フロントエンド | Vite + React + Tanstack Router |
| バックエンド | Hono on Cloudflare Workers |
| DB | Cloudflare D1 + Drizzle ORM |
| ストレージ | Cloudflare R2 |
| 認証 | Google OAuth（マルチプロバイダー対応設計） |
| AI | OpenRouter経由（Gemini 2.5 Flash, Qwen3-8B, GPT-4o mini） |
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
| `/frontend-design` | 和モダンデザイン方針でUIコンポーネントを作成（カラーパレット: indigo, ink, jade, amber, crimson） |

### 開発・テスト
| スキル | 説明 |
|--------|------|
| `/check-types` | TypeScript型チェックとESLintを実行 |
| `/run-dev` | 開発サーバーを起動 |
| `/db-migrate` | Drizzleマイグレーションを生成・適用 |
| `/test-api` | APIテスト（モックAdapter使用、SSE対応） |
| `/browser-test` | ブラウザでの動作確認（CORS、Cookie、認証フローの検証） |
| `/ui-skills` | UIコンポーネント構築の制約（Tailwind、アクセシビリティ、アニメーション等） |

### コードレビュー・分析
| スキル | 説明 |
|--------|------|
| `/codex` | Codex CLIでコードレビュー・バグ調査・リファクタリング提案 |
| `/code-review` | サブエージェント+Codexで並列レビュー→LGTMまで修正 |
| `/security-review` | 複数視点でのセキュリティレビュー（Explore + Codex + ペネトレーション） |
| `/pre-check` | 実装前チェック（既存資産確認、見積もり精度向上、設計意図理解） |

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