---
name: drizzle-schema
description: Drizzle ORMのテーブルスキーマを作成する
---

# Drizzle スキーマ作成

Cloudflare D1用のDrizzleテーブルスキーマを作成する。

## ディレクトリ構造

```
packages/db/
├── src/
│   ├── index.ts         # エクスポート
│   └── schema/
│       ├── index.ts     # 全スキーマのエクスポート
│       ├── auth.ts      # 認証関連
│       ├── topic.ts     # 科目・論点関連
│       ├── chat.ts      # チャット関連
│       └── note.ts      # ノート関連
├── migrations/
└── drizzle.config.ts
```

## テーブル設計パターン

### 基本テンプレート
```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const {tableName} = sqliteTable("{table_name}", {
  id: text("id").primaryKey(),
  // ... カラム定義
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})
```

### リレーション定義
```typescript
import { relations } from "drizzle-orm"

export const {parentTable}Relations = relations({parentTable}, ({ many }) => ({
  {children}: many({childTable}),
}))

export const {childTable}Relations = relations({childTable}, ({ one }) => ({
  {parent}: one({parentTable}, {
    fields: [{childTable}.{parentId}],
    references: [{parentTable}.id],
  }),
}))
```

## 主要テーブル一覧（本プロジェクト）

| テーブル | 説明 |
|---------|------|
| users | ユーザー |
| user_oauth_connections | OAuth接続（複数プロバイダー対応） |
| subjects | 科目（財務会計論など） |
| categories | 大分類 |
| topics | 論点 |
| user_topic_progress | ユーザー別進捗 |
| chat_sessions | チャットセッション |
| chat_messages | チャットメッセージ |
| notes | ノート（AI要約 + ユーザーメモ） |
| images | 画像メタデータ |

## カラム型のガイドライン

| 用途 | 型 | 例 |
|-----|-----|-----|
| UUID | `text("id").primaryKey()` | id |
| 外部キー | `text("xxx_id").references(() => xxx.id)` | userId |
| タイムスタンプ | `integer("xxx", { mode: "timestamp" })` | createdAt |
| Enum | `text("xxx").$type<"a" \| "b">()` | role |
| JSON | `text("xxx", { mode: "json" })` | metadata |
| Boolean | `integer("xxx", { mode: "boolean" })` | isActive |

## マイグレーション

```bash
# マイグレーション生成
pnpm --filter @cpa-study/db drizzle-kit generate

# マイグレーション適用（ローカル）
pnpm --filter @cpa-study/db drizzle-kit migrate

# マイグレーション適用（D1）
wrangler d1 migrations apply cpa-study-db
```
