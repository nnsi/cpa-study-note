# InkTopik

> 論点に残す、あとから効く

汎用学習サポートアプリ。学習領域（公認会計士試験、簿記など）を選択し、論点単位で学習の痕跡を残す。

## 機能一覧

### 学習管理

| 機能 | 説明 |
|------|------|
| 学習領域管理 | 学習領域（公認会計士試験、簿記等）の選択・切替 |
| 科目・単元・論点管理 | 階層構造（科目→単元→論点）での学習項目管理、CSV一括インポート |
| 学習セッション記録 | 論点単位での学習記録・履歴追跡 |
| 学習進捗 | 論点ごとの理解度・学習回数の可視化 |
| 学習メトリクス | 学習時間・頻度の統計ダッシュボード |

### コンテンツ

| 機能 | 説明 |
|------|------|
| ノート | 論点に紐づくマークダウン形式の学習メモ作成・編集 |
| AIチャット | 論点に関する質問・解説をAIとSSEストリーミングで対話 |
| 画像アップロード | 教材・ノートの画像をR2に保存（マジックバイト検証によるセキュリティ対策） |
| 演習問題 | 論点に紐づく演習問題の管理 |

### ナビゲーション

| 機能 | 説明 |
|------|------|
| ブックマーク | よく参照する論点のブックマーク |
| 検索 | 論点・ノートの横断検索 |
| レビューモード | 学習内容の復習・テスト |
| カスタムビュー | 論点の表示をカスタマイズ |

### AI機能

| 機能 | 説明 |
|------|------|
| 論点自動生成 | 画像・テキストからAIが論点を自動抽出・作成 |
| Vision OCR | 教材画像のテキスト認識 |

### 認証

| 機能 | 説明 |
|------|------|
| Google OAuth | Google アカウントでのログイン（マルチプロバイダー対応設計） |
| JWT認証 | アクセストークン + リフレッシュトークンによるセッション管理 |

## 技術スタック

| 領域 | 技術 |
|-----|------|
| フロントエンド | Vite 6 + React 19 + TanStack Router |
| バックエンド | Hono on Cloudflare Workers |
| DB | Cloudflare D1 + Drizzle ORM |
| ストレージ | Cloudflare R2 |
| 認証 | Google OAuth + JWT (jose) |
| AI | OpenRouter経由（Gemini 2.5 Flash, Qwen3-8B, GPT-4o mini） |
| 状態管理 | Zustand + TanStack React Query |
| UI | Tailwind CSS + Lucide Icons |
| テスト | Vitest |
| 構成 | pnpm workspace モノレポ |
| インフラ | Terraform（Cloudflareリソース管理） |

## アーキテクチャ

### バックエンド（Clean Architecture）

```
Route → UseCase → Repository → Domain
```

- **Package by Feature**: `apps/api/src/features/{feature}/` に機能単位で分離
- 関数型スタイル（クラス不使用）、エラーは `Result<T, E>` 型で表現

### フロントエンド（3層分離）

```
Logic（純粋関数） → Hooks（状態管理） → Components（描画）
```

### 共有パッケージ

- **Zodスキーマ**: `packages/shared/` でAPI契約を一元管理
- **Drizzleスキーマ**: `packages/db/` でテーブル定義・マイグレーション管理

## ディレクトリ構造

```
cpa-study-note/
├── apps/
│   ├── api/                    # Hono API (Cloudflare Workers)
│   │   └── src/features/
│   │       ├── auth/           # OAuth認証・JWT管理
│   │       ├── chat/           # AIチャット（SSE）
│   │       ├── subject/        # 科目・単元・論点（CSV取込）
│   │       ├── note/           # ノート管理
│   │       ├── image/          # 画像アップロード（R2）
│   │       ├── exercise/       # 演習問題
│   │       ├── bookmark/       # ブックマーク
│   │       ├── learning/       # 学習セッション
│   │       ├── metrics/        # 学習メトリクス
│   │       ├── study-domain/   # 学習領域管理
│   │       ├── topic-generator/# AI論点自動生成
│   │       └── view/           # カスタムビュー
│   └── web/                    # React SPA
│       └── src/
│           ├── features/       # 機能別モジュール（3層分離）
│           │   ├── home/       # ダッシュボード
│           │   ├── study-domain/# 学習領域選択
│           │   ├── subject/    # 科目階層ブラウジング
│           │   ├── topic/      # 論点詳細
│           │   ├── note/       # ノート作成・編集
│           │   ├── chat/       # AIチャットUI
│           │   ├── exercise/   # 演習問題UI
│           │   ├── image/      # 画像アップロードUI
│           │   ├── bookmark/   # ブックマーク管理
│           │   ├── search/     # 横断検索
│           │   ├── review/     # レビューモード
│           │   ├── progress/   # 学習進捗
│           │   ├── metrics/    # 学習メトリクス
│           │   └── topic-generator/ # AI論点生成UI
│           ├── components/     # 共通UIコンポーネント
│           └── routes/         # TanStack Routerルート定義
├── packages/
│   ├── shared/                 # Zodスキーマ + 型定義
│   └── db/                     # Drizzleスキーマ + マイグレーション
├── docs/
│   ├── plan/                   # 設計ドキュメント
│   ├── adr/                    # アーキテクチャ決定記録
│   ├── diary/                  # 開発日記
│   └── design/                 # デザインドキュメント
├── infra/                      # Terraform（IaC）
├── scripts/                    # ユーティリティスクリプト
└── .github/workflows/          # CI/CD設定
```

## セットアップ

```bash
# 依存関係インストール
pnpm install

# 開発サーバー起動
pnpm dev

# 個別起動
pnpm dev:api  # APIサーバー
pnpm dev:web  # Webアプリ
```

## コマンド

```bash
# 型チェック・リント
pnpm typecheck
pnpm lint

# テスト
pnpm test              # 全テスト実行
pnpm test:api          # APIテスト
pnpm test:web          # Webテスト
pnpm test:shared       # 共有パッケージテスト
pnpm test:coverage     # カバレッジ付き

# DBマイグレーション
pnpm db:generate       # マイグレーション生成
pnpm db:migrate        # マイグレーション適用
pnpm db:seed           # シードデータ投入

# ビルド・デプロイ
pnpm build
pnpm --filter @cpa-study/api deploy
pnpm --filter @cpa-study/web deploy
```

## テスト

### テスト構成

| 種類 | 対象 | 特徴 |
|------|------|------|
| Domain | 型・スキーマ | Zodスキーマのparse/safeParseを検証 |
| Repository | DB操作 | インメモリDBで実際のSQL実行 |
| UseCase | ビジネスロジック | モック注入でユニットテスト |
| Route | APIエンドポイント | Honoのapp.request()で統合テスト |
| E2E | 複数API連携 | 一連のフローを検証 |
| Security | セキュリティ | マジックバイト検証、パストラバーサル防止 |

### テスト環境

- **フレームワーク**: Vitest
- **DB**: better-sqlite3によるインメモリSQLite（D1互換）
- **R2**: インメモリMapによるモック
- **AI**: 固定レスポンスを返すモックアダプター
- **認証**: ローカル環境では`X-Dev-User-Id`ヘッダーで認証スキップ

## CI/CD

GitHub Actionsで以下を自動実行:
- 型チェック
- 全テスト実行
- カバレッジレポート生成
