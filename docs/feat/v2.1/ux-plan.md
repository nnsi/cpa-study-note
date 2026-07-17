# UX改善計画: 学習導線の短縮

## 背景

現在の学習タブは論点に到達するまで5回クリックが必要:

```
学習領域 → 科目一覧 → 大単元 → 中単元 → 論点詳細
   1          2          3        4         5
```

これはデータ整理には適切だが、学習へのアクセス導線としては破綻している。

## 目的

論点へのアクセスを **5クリック → 1クリック** に短縮し、ユーザー離脱を防ぐ

## 解決策

「整理構造」と「アクセス導線」を分離し、複数のショートカットを提供する。

---

## 実装する機能

### 1. グローバル検索

**効果**: 0→1クリックで任意の論点へ

- 論点名・説明でインクリメンタル検索
- `Ctrl+K` / `Cmd+K` でフォーカス
- PC: 中央モーダル、モバイル: フルスクリーン
- 検索結果から論点詳細へ直接遷移

```
┌─────────────────────────────────────────┐
│  🔍 論点を検索...            Ctrl+K     │
└─────────────────────────────────────────┘
         ↓ インクリメンタル検索
┌─────────────────────────────────────────┐
│ 「減価償却」で検索                        │
├─────────────────────────────────────────┤
│ 📄 減価償却の基本      簿記 > 固定資産    │
│ 📄 減価償却費の計算    財務会計 > 費用    │
└─────────────────────────────────────────┘
```

### 2. 続きから学習

**効果**: 1クリックで最近の論点へ

- ダッシュボード上部に最近アクセスした論点をカード表示
- 「続ける→」ボタンで即座に論点詳細へ
- 既存API `GET /subjects/progress/recent` を活用

```
┌──────────────────────────────────────────────────┐
│ 📚 続きから学習                                   │
│ ┌────────────────┐ ┌────────────────┐            │
│ │ 減価償却の基本  │ │ 棚卸資産の評価  │ ← 横スクロール│
│ │ 3時間前        │ │ 昨日           │            │
│ │     [続ける→] │ │     [続ける→] │            │
│ └────────────────┘ └────────────────┘            │
└──────────────────────────────────────────────────┘
```

### 3. ブックマーク（全階層対応）

**効果**: 1クリックでよく使う科目・単元・論点へ

- **科目・大単元・中単元・論点** すべてブックマーク可能
- 各画面に☆トグル追加
- ダッシュボードにブックマーク一覧表示
- DBテーブル `user_bookmarks` 新規作成（汎用設計）

```
┌──────────────────────────────────────────────────┐
│ ⭐ ブックマーク                                   │
│ 📘 簿記論（科目）                                 │
│ 📁 固定資産（中単元）                             │
│ 📄 減価償却の基本（論点）                         │
└──────────────────────────────────────────────────┘
```

---

## ダッシュボード新レイアウト

```
┌─────────────────────────────────────────────┐
│ こんにちは、○○さん                          │
├─────────────────────────────────────────────┤
│ 📚 続きから学習                              │
│ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │論点A │ │論点B │ │論点C │  ← 横スクロール   │
│ └─────┘ └─────┘ └─────┘                    │
├─────────────────────────────────────────────┤
│ ⭐ ブックマーク                              │
│ 📘科目A  📁単元B  📄論点C                   │
├─────────────────────────────────────────────┤
│ 今日の活動 │ 最近の論点（既存）               │
├─────────────────────────────────────────────┤
│ クイックアクセス（既存4枚）                   │
├─────────────────────────────────────────────┤
│ 学習進捗 / 学習推移（既存）                   │
└─────────────────────────────────────────────┘
```

---

## スマホ対応

| 機能 | PC | モバイル |
|------|-----|---------|
| 検索 | ヘッダーにアイコン + Ctrl+K | ヘッダーにアイコン → フルスクリーンモーダル |
| 続きから | 横スクロールカード | 縦積みカード |
| ブックマーク | タイプ別グループ表示 | 縦リスト |
| ブックマークボタン | 各画面のタイトル横に☆ | 同じ（タップ領域大きめ） |

ブレークポイント: `lg:` (1024px) を既存に合わせる

---

## 技術設計

### Phase 1: ブックマーク機能（全階層対応）

#### DBスキーマ
**`packages/db/src/schema/bookmark.ts`** (新規)
```typescript
export const userBookmarks = sqliteTable(
  "user_bookmarks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(), // "subject" | "category" | "topic"
    targetId: text("target_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    unique().on(table.userId, table.targetType, table.targetId),
    index("user_bookmarks_user_id_idx").on(table.userId),
    index("user_bookmarks_target_idx").on(table.targetType, table.targetId),
  ]
)
```

#### API
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/bookmarks` | ブックマーク一覧取得（階層情報付き） |
| POST | `/api/bookmarks` | ブックマーク追加 |
| DELETE | `/api/bookmarks/:targetType/:targetId` | ブックマーク削除 |

**リクエスト/レスポンス例:**
```typescript
// POST /api/bookmarks
{ targetType: "category", targetId: "cat_123" }

// GET /api/bookmarks レスポンス
{
  bookmarks: [
    { targetType: "subject", targetId: "sub_1", name: "簿記論", path: "簿記論" },
    { targetType: "category", targetId: "cat_1", name: "固定資産", path: "簿記論 > 資産 > 固定資産" },
    { targetType: "topic", targetId: "top_1", name: "減価償却", path: "簿記論 > 資産 > 固定資産 > 減価償却" },
  ]
}
```

#### バックエンド構成
**`apps/api/src/features/bookmark/`** (新規Feature)
- `repository.ts` - CRUD操作 + 階層情報取得
- `usecase.ts` - ビジネスロジック
- `route.ts` - エンドポイント定義

#### フロントエンド構成
**`apps/web/src/features/bookmark/`** (新規)
- `api.ts` - Hono RPC クライアント
- `hooks.ts` - `useBookmarks()`, `useToggleBookmark()`
- `components/BookmarkButton.tsx` - ☆トグル（全画面共通）
- `components/BookmarksList.tsx` - ダッシュボード用（タイプ別グループ表示）

---

### Phase 2: グローバル検索

#### API
```
GET /api/subjects/search?q=<query>&limit=10
```

レスポンス:
```typescript
{
  topics: Array<{
    topicId: string
    topicName: string
    description: string | null
    subjectId: string
    subjectName: string
    categoryId: string
    categoryName: string
  }>
}
```

#### 共有スキーマ
**`packages/shared/src/schemas/topic.ts`**
```typescript
export const topicSearchRequestSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})
```

#### バックエンド
**`apps/api/src/features/topic/`** 拡張
- `repository.ts` - `searchTopics(userId, query, limit)` 追加
- `usecase.ts` - `searchTopics` UseCase追加
- `route.ts` - `GET /search` 追加

#### フロントエンド
**`apps/web/src/features/search/`** (新規)
- `api.ts` - 検索API呼び出し
- `hooks.ts` - `useGlobalSearch(query)` (300msデバウンス)
- `logic.ts` - キーボードショートカット判定
- `components/GlobalSearchModal.tsx` - 検索モーダル
- `components/SearchInput.tsx` - 入力フィールド
- `components/SearchResultItem.tsx` - 結果の1行

---

### Phase 3: 続きから学習

#### フロントエンド
**`apps/web/src/features/home/components/ContinueLearningSection.tsx`** (新規)
- 既存API `GET /subjects/progress/recent` を活用
- カード形式で最近の論点を表示
- PC: 横スクロール、モバイル: 縦積み

---

## 修正ファイル一覧

### 新規作成
```
packages/db/src/schema/bookmark.ts
packages/shared/src/schemas/bookmark.ts

apps/api/src/features/bookmark/
  ├─ index.ts
  ├─ repository.ts
  ├─ usecase.ts
  └─ route.ts

apps/web/src/features/search/
  ├─ index.ts
  ├─ api.ts
  ├─ hooks.ts
  ├─ logic.ts
  └─ components/
      ├─ GlobalSearchModal.tsx
      ├─ SearchInput.tsx
      └─ SearchResultItem.tsx

apps/web/src/features/bookmark/
  ├─ index.ts
  ├─ api.ts
  ├─ hooks.ts
  └─ components/
      ├─ BookmarkButton.tsx
      └─ BookmarksList.tsx

apps/web/src/features/home/components/ContinueLearningSection.tsx
```

### 修正
```
packages/db/src/schema/index.ts (userBookmarks export追加)
packages/shared/src/schemas/index.ts (export追加)
packages/shared/src/schemas/topic.ts (検索スキーマ追加)

apps/api/src/index.ts (bookmarkRoutes追加)
apps/api/src/features/topic/repository.ts (searchTopics追加)
apps/api/src/features/topic/usecase.ts (searchTopics追加)
apps/api/src/features/topic/route.ts (/search追加)

apps/web/src/components/layout/Header.tsx (検索アイコン追加)
apps/web/src/routes/__root.tsx (キーボードショートカット)
apps/web/src/routes/index.tsx (ダッシュボードレイアウト)
apps/web/src/features/topic/components/TopicInfo.tsx (BookmarkButton追加)
apps/web/src/features/subject/components/ (BookmarkButton追加)
apps/web/src/features/home/index.ts (export追加)
```

---

## 検証方法

### Phase 1: ブックマーク
1. `pnpm --filter db db:generate && pnpm --filter db db:migrate`
2. `pnpm --filter api dev` + `pnpm --filter web dev`
3. curl で API テスト
   - `POST /api/bookmarks` (科目・単元・論点それぞれ)
   - `GET /api/bookmarks`
   - `DELETE /api/bookmarks/:targetType/:targetId`
4. ブラウザで各画面（科目・単元・論点）の☆トグル確認
5. ダッシュボードでブックマーク表示確認（タイプ別グループ）

### Phase 2: グローバル検索
1. curl で `GET /api/subjects/search?q=減価` テスト
2. ブラウザで Ctrl+K → モーダル表示確認
3. 検索して論点クリック → 遷移確認
4. スマホビュー（DevTools）でフルスクリーン確認

### Phase 3: 続きから学習
1. いくつかの論点にアクセスして lastAccessedAt を更新
2. ダッシュボードで「続きから学習」表示確認
3. 「続ける→」クリックで遷移確認
4. スマホビューで縦積み確認
