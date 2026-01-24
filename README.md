# CPA Study Note

公認会計士試験の学習をサポートするアプリケーション。

## 技術スタック

| 領域 | 技術 |
|-----|------|
| フロントエンド | Vite + React + TanStack Router |
| バックエンド | Hono on Cloudflare Workers |
| DB | Cloudflare D1 + Drizzle ORM |
| ストレージ | Cloudflare R2 |
| 認証 | Google OAuth |
| AI | OpenRouter経由（DeepSeek-V3, Vision OCR） |
| UI | Tailwind CSS |
| 構成 | pnpm workspace モノレポ |

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

## テスト

### コマンド

```bash
# 全テスト実行
pnpm test

# 個別実行
pnpm test:api      # APIテスト（481テスト）
pnpm test:web      # Webテスト（42テスト）
pnpm test:shared   # 共有パッケージテスト

# ウォッチモード
pnpm --filter @cpa-study/api test:watch
pnpm --filter @cpa-study/web test:watch

# カバレッジ付き
pnpm test:coverage
```

### テスト構成

```
apps/api/src/
├── features/
│   ├── auth/
│   │   ├── domain.test.ts      # 型検証
│   │   ├── repository.test.ts  # DB操作
│   │   ├── usecase.test.ts     # ビジネスロジック
│   │   └── route.test.ts       # APIエンドポイント
│   ├── chat/
│   ├── topic/
│   ├── note/
│   └── image/
│       └── security.test.ts    # セキュリティ（マジックバイト検証等）
└── test/
    ├── mocks/
    │   ├── db.ts     # better-sqlite3 インメモリDB
    │   ├── r2.ts     # R2Bucket インメモリモック
    │   └── ai.ts     # AIAdapter モック
    ├── helpers.ts    # テストユーティリティ
    └── e2e/          # E2Eテスト
        ├── auth-flow.test.ts
        ├── learning-flow.test.ts
        ├── chat-flow.test.ts
        ├── note-flow.test.ts
        └── image-flow.test.ts

apps/web/src/features/
├── chat/
│   ├── logic.test.ts   # 純粋関数テスト
│   └── hooks.test.ts   # Reactフックテスト
├── image/
│   └── hooks.test.ts
└── progress/
    └── hooks.test.ts
```

### テスト環境

- **フレームワーク**: Vitest
- **DB**: better-sqlite3によるインメモリSQLite（D1互換）
- **R2**: インメモリMapによるモック
- **AI**: 固定レスポンスを返すモックアダプター
- **認証**: ローカル環境では`X-Dev-User-Id`ヘッダーで認証スキップ

### テストの種類

| 種類 | 対象 | 特徴 |
|------|------|------|
| Domain | 型・スキーマ | Zodスキーマのparse/safeParseを検証 |
| Repository | DB操作 | インメモリDBで実際のSQL実行 |
| UseCase | ビジネスロジック | モック注入でユニットテスト |
| Route | APIエンドポイント | Honoのapp.request()で統合テスト |
| E2E | 複数API連携 | 一連のフローを検証 |
| Security | セキュリティ | マジックバイト検証、パストラバーサル防止 |

### テスト作成時の注意

1. **モックの使い方**
   ```typescript
   import { createTestDatabase, seedTestData } from "@/test/mocks/db"
   import { createMockR2Bucket } from "@/test/mocks/r2"
   import { createMockAIAdapter } from "@/test/mocks/ai"

   const { db, sqlite } = createTestDatabase()
   const testData = seedTestData(db)
   const r2 = createMockR2Bucket()
   const ai = createMockAIAdapter({ textResponse: "..." })
   ```

2. **SSEストリーミングのテスト**
   ```typescript
   const res = await app.request("/api/chat/...", { method: "POST", ... })
   const text = await res.text()
   const events = text.split("\n\n").filter(Boolean)
   ```

3. **認証のテスト**
   - ローカル環境: `X-Dev-User-Id`ヘッダーで認証
   - 本番環境テスト: JWTトークンをAuthorizationヘッダーに設定

## その他のコマンド

```bash
# 型チェック
pnpm typecheck

# リント
pnpm lint

# DBマイグレーション
pnpm db:generate  # マイグレーション生成
pnpm db:migrate   # マイグレーション適用
pnpm db:seed      # シードデータ投入

# ビルド
pnpm build

# デプロイ
pnpm --filter @cpa-study/api deploy
pnpm --filter @cpa-study/web deploy
```

## ディレクトリ構造

```
cpa-study-note/
├── apps/
│   ├── api/          # Hono API (Cloudflare Workers)
│   └── web/          # React SPA
├── packages/
│   ├── shared/       # 共有型定義 + Zodスキーマ
│   └── db/           # Drizzle スキーマ + マイグレーション
├── docs/
│   ├── plan/         # 設計ドキュメント
│   └── diary/        # 開発日記
└── .github/
    └── workflows/    # CI設定
```

## CI/CD

GitHub Actionsで以下を自動実行:
- 型チェック
- 全テスト実行
- カバレッジレポート生成
