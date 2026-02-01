# UX改善タスクリスト

## Phase 1: ブックマーク機能（全階層対応）

### DB・スキーマ
- [ ] `packages/db/src/schema/bookmark.ts` 新規作成
  - [ ] `userBookmarks` テーブル定義（targetType + targetId）
- [ ] `packages/db/src/schema/index.ts` に export 追加
- [ ] `pnpm --filter db db:generate` でマイグレーション生成
- [ ] `pnpm --filter db db:migrate` でマイグレーション適用

### 共有スキーマ
- [ ] `packages/shared/src/schemas/bookmark.ts` 新規作成
  - [ ] `bookmarkTargetTypeSchema` 定義（"subject" | "category" | "topic"）
  - [ ] `addBookmarkRequestSchema` 定義
  - [ ] `bookmarkResponseSchema` 定義
  - [ ] `bookmarkListResponseSchema` 定義
- [ ] `packages/shared/src/schemas/index.ts` に export 追加

### バックエンド
- [ ] `apps/api/src/features/bookmark/repository.ts` 新規作成
  - [ ] `findBookmarksByUser` 実装（階層情報付きで取得）
  - [ ] `addBookmark` 実装
  - [ ] `removeBookmark` 実装
  - [ ] `isBookmarked` 実装
- [ ] `apps/api/src/features/bookmark/usecase.ts` 新規作成
  - [ ] `getBookmarks` UseCase（名前・パス情報を付与）
  - [ ] `addBookmark` UseCase
  - [ ] `removeBookmark` UseCase
- [ ] `apps/api/src/features/bookmark/route.ts` 新規作成
  - [ ] `GET /bookmarks` エンドポイント
  - [ ] `POST /bookmarks` エンドポイント
  - [ ] `DELETE /bookmarks/:targetType/:targetId` エンドポイント
- [ ] `apps/api/src/features/bookmark/index.ts` 新規作成
- [ ] `apps/api/src/index.ts` に bookmarkRoutes 追加

### フロントエンド
- [ ] `apps/web/src/features/bookmark/api.ts` 新規作成
- [ ] `apps/web/src/features/bookmark/hooks.ts` 新規作成
  - [ ] `useBookmarks` hook
  - [ ] `useToggleBookmark` hook（targetType + targetId を受け取る）
- [ ] `apps/web/src/features/bookmark/components/BookmarkButton.tsx` 新規作成
  - [ ] Props: `targetType`, `targetId`, `size?`
  - [ ] ☆ / ★ トグル表示
- [ ] `apps/web/src/features/bookmark/components/BookmarksList.tsx` 新規作成
  - [ ] タイプ別グループ表示（科目 / 単元 / 論点）
  - [ ] 各アイテムに遷移リンク
- [ ] `apps/web/src/features/bookmark/index.ts` 新規作成
- [ ] 各画面に BookmarkButton 追加
  - [ ] 論点詳細画面（TopicInfo.tsx）
  - [ ] 中単元画面（カテゴリ一覧）
  - [ ] 科目詳細画面
- [ ] `apps/web/src/routes/index.tsx` にブックマークセクション追加

### 検証
- [ ] curl で `POST /api/bookmarks` テスト（科目）
- [ ] curl で `POST /api/bookmarks` テスト（単元）
- [ ] curl で `POST /api/bookmarks` テスト（論点）
- [ ] curl で `GET /api/bookmarks` テスト
- [ ] curl で `DELETE /api/bookmarks/:targetType/:targetId` テスト
- [ ] ブラウザで科目画面の☆トグル確認
- [ ] ブラウザで単元画面の☆トグル確認
- [ ] ブラウザで論点詳細の☆トグル確認
- [ ] ダッシュボードでブックマーク表示確認
- [ ] スマホビューで表示確認

---

## Phase 2: グローバル検索

### 共有スキーマ
- [ ] `packages/shared/src/schemas/topic.ts` に検索スキーマ追加
  - [ ] `topicSearchRequestSchema` 定義
  - [ ] `topicSearchResultSchema` 定義
  - [ ] `topicSearchResponseSchema` 定義

### バックエンド
- [ ] `apps/api/src/features/topic/repository.ts` に `searchTopics` 追加
- [ ] `apps/api/src/features/topic/usecase.ts` に `searchTopics` UseCase 追加
- [ ] `apps/api/src/features/topic/route.ts` に `GET /search` エンドポイント追加

### フロントエンド
- [ ] `apps/web/src/features/search/api.ts` 新規作成
- [ ] `apps/web/src/features/search/hooks.ts` 新規作成
  - [ ] `useGlobalSearch` hook（300msデバウンス）
  - [ ] `useSearchModal` hook（開閉状態管理）
- [ ] `apps/web/src/features/search/logic.ts` 新規作成
  - [ ] キーボードショートカット判定
  - [ ] 検索結果のナビゲーションURL生成
- [ ] `apps/web/src/features/search/components/SearchInput.tsx` 新規作成
- [ ] `apps/web/src/features/search/components/SearchResultItem.tsx` 新規作成
- [ ] `apps/web/src/features/search/components/GlobalSearchModal.tsx` 新規作成
  - [ ] PC版モーダルレイアウト
  - [ ] モバイル版フルスクリーンレイアウト
  - [ ] キーボードナビゲーション（矢印キー + Enter）
- [ ] `apps/web/src/features/search/index.ts` 新規作成
- [ ] `apps/web/src/components/layout/Header.tsx` に検索アイコン追加
- [ ] `apps/web/src/routes/__root.tsx` に Ctrl+K ショートカット登録

### 検証
- [ ] curl で `GET /api/subjects/search?q=減価` テスト
- [ ] ブラウザで Ctrl+K でモーダル表示確認
- [ ] 検索入力でインクリメンタル検索確認
- [ ] 検索結果クリックで論点詳細へ遷移確認
- [ ] 矢印キー + Enter でのナビゲーション確認
- [ ] スマホビュー（DevTools）でフルスクリーン確認
- [ ] Escape キーでモーダル閉じる確認

---

## Phase 3: 続きから学習

### フロントエンド
- [ ] `apps/web/src/features/home/components/ContinueLearningSection.tsx` 新規作成
  - [ ] カード形式のレイアウト
  - [ ] PC: 横スクロール
  - [ ] モバイル: 縦積み
  - [ ] 「続ける→」ボタン
  - [ ] 最終アクセス日時の相対表示
- [ ] `apps/web/src/features/home/index.ts` に export 追加
- [ ] `apps/web/src/routes/index.tsx` のダッシュボードレイアウト変更
  - [ ] 「続きから学習」セクションを上部に配置
  - [ ] 既存セクションの配置調整

### 検証
- [ ] いくつかの論点にアクセスして lastAccessedAt 更新
- [ ] ダッシュボードで「続きから学習」セクション表示確認
- [ ] 「続ける→」クリックで論点詳細へ遷移確認
- [ ] 最近アクセスした論点が正しい順序で表示されるか確認
- [ ] スマホビューで縦積み表示確認

---

## 最終確認

- [ ] 全機能の型チェック（`pnpm check-types`）
- [ ] ESLint エラーなし（`pnpm lint`）
- [ ] PC ブラウザでの E2E 動作確認
- [ ] モバイルビュー（DevTools）での動作確認
- [ ] 実機（スマホ）での動作確認（可能であれば）
