# リファクタリングタスクリスト（fb-2 + subject-slice-plan）

## 概要

`fb-2.md`で指摘された課題と`subject-slice-plan.md`の設計方針を統合したリファクタリングタスク。
優先度は「拡張性への効き」と「セキュリティリスク」を基準に設定。

---

## Phase 0: 緊急対応（セキュリティ/整合性）

### C) ブックマーク機能のユーザー境界修正
- [x] `apps/api/src/features/bookmark/repository.ts` の `targetExists()` に `userId` と `deletedAt IS NULL` 条件を追加
- [x] `apps/api/src/features/bookmark/repository.ts` の `getBookmarkDetails()` に `userId` / `deletedAt` 条件を追加
- [x] `apps/api/src/features/bookmark/usecase.ts` で境界検証関数を使用するよう修正
- [x] `apps/api/src/test/e2e/multi-user-boundary.test.ts` に bookmark の越境テストを追加

---

## Phase 1: 下地作成（エラー契約統一 + 共有スキーマ整備）

### A) エラーレスポンス仕様の統一
- [x] `packages/shared/src/schemas/error.ts` を `{ error: { code, message, details? } }` 形式に更新
- [x] `apps/api/src/shared/lib/errors.ts` の `AppError` コードを共有スキーマと整合させる
- [x] `apps/api/src/index.ts` のグローバル `onError` を統一形式に修正
- [x] `apps/web/src/features/*/api.ts` のエラーハンドリングを `error.message` 参照に統一

### D) subject route の旧スタイル箇所を handleResult に統一
- [x] `apps/api/src/features/subject/route.ts` の `detail` エンドポイントを `handleResult` 化
- [x] `apps/api/src/features/subject/route.ts` の `categories` エンドポイントを `handleResult` 化
- [x] `apps/api/src/features/subject/route.ts` の `topics` エンドポイントを `handleResult` 化
- [x] `apps/api/src/features/subject/route.ts` の `progress` エンドポイントを `handleResult` 化
- [x] `apps/api/src/features/subject/route.ts` の `check-history` エンドポイントを `handleResult` 化

### 共有スキーマ整備
- [x] `packages/shared/src/schemas/learning/` ディレクトリを作成
- [x] `packages/shared/src/schemas/view/` ディレクトリを作成
- [x] `TopicProgress` / `TopicCheckHistory` スキーマを `learning/` に定義
- [x] `TopicView` / `SubjectDashboardView` / `TopicReviewListView` スキーマを `view/` に定義

---

## Phase 2: Learning 機能の分離

### feature 作成
- [x] `apps/api/src/features/learning/` ディレクトリを作成
- [x] `apps/api/src/features/learning/route.ts` を作成
- [x] `apps/api/src/features/learning/usecase.ts` を作成
- [x] `apps/api/src/features/learning/repository.ts` を作成

### 既存ロジックの移行
- [x] `subject` の progress 関連 UseCase を `learning` に移動
- [x] `subject` の check-history 関連 UseCase を `learning` に移動
- [x] `subject` の `lastAccessedAt` 更新ロジックを `learning/touch` に移動
- [x] `chat` が呼んでいる progress 更新先を `learning` に変更

### API エンドポイント
- [x] `POST /api/learning/topics/:topicId/touch` を実装
- [x] `PUT /api/learning/topics/:topicId/progress` を実装
- [x] `GET /api/learning/topics/:topicId/progress` を実装
- [x] `GET /api/learning/topics/:topicId/check-history` を実装
- [x] `GET /api/learning/topics/recent` を実装
- [x] `GET /api/learning/subjects/progress-stats` を実装

### テスト
- [x] `apps/api/src/features/learning/route.test.ts` を作成
- [x] Learning API の境界テスト（userId/deletedAt）を追加

---

## Phase 3: View 機能の導入

### feature 作成
- [x] `apps/api/src/features/view/` ディレクトリを作成
- [x] `apps/api/src/features/view/route.ts` を作成
- [x] `apps/api/src/features/view/usecase.ts` を作成
- [x] `apps/api/src/features/view/repositories/topicViewRepo.ts` を作成
- [x] `apps/api/src/features/view/repositories/subjectDashboardViewRepo.ts` を作成
- [x] `apps/api/src/features/view/repositories/reviewListViewRepo.ts` を作成

### API エンドポイント
- [x] `GET /api/view/topics/:topicId` を実装（Topic 画面合成ビュー）
- [x] `GET /api/view/subjects/:subjectId/dashboard` を実装（Subject ダッシュボード）
- [x] `GET /api/view/topics` を実装（レビュー一覧 + フィルタ）

### View の境界ルール徹底
- [x] すべての View クエリで `userId` 条件を必須化
- [x] すべての View クエリで `deleted_at IS NULL` を徹底
- [x] View が DB を更新しないことを保証するテストを追加

### フロントエンド対応
- [x] Topic 画面で `touch` → `view/topics/:id` の呼び出しパターンに変更
- [x] Subject ダッシュボードで `view/subjects/:id/dashboard` を使用
- [x] レビュー一覧で `view/topics` を使用

---

## Phase 4: 既存 API の移行と削除

> **Note**: Phase 2-3 で Learning/View を分離すると、subject には Curriculum（構造管理）のみが残る。
> そのため「usecase/repo の分割」は不要。代わりに移行後の不要コード削除を行う。

### subject から移行済みコードの削除
- [x] `apps/api/src/features/subject/usecase.ts` から Learning 系関数を削除
  - `getTopicWithProgress`, `updateProgress`, `listUserProgress`, `getCheckHistory`, `getSubjectProgressStats`, `listRecentTopics`
- [x] `apps/api/src/features/subject/usecase.ts` から View 系関数を削除
  - `listSubjectsWithStats`, `getSubjectWithStats`, `listCategoriesHierarchy`, `filterTopics`, `searchTopicsInDomain`
- [x] `apps/api/src/features/subject/repository.ts` から不要メソッドを削除
  - Progress 系: `findProgress`, `upsertProgress`, `findProgressByUser`, `getProgressCountsByCategory`, `getProgressCountsBySubject`, `findRecentTopics`
  - Check History 系: `createCheckHistory`, `findCheckHistoryByTopic`
  - Filter/Search 系: `findFilteredTopics`, `searchTopics`
  - Stats 系（View が担当）: `getSubjectStats`, `getBatchSubjectStats`, `getCategoryTopicCounts`

### 旧エンドポイントの廃止
- [x] `apps/api/src/features/subject/route.ts` から移行済みエンドポイントを削除
  - `/filter`, `/search`, `/progress/me`, `/progress/subjects`, `/progress/recent`
  - `/:subjectId/detail`, `/:subjectId/categories`
  - `/:subjectId/topics/:topicId`, `/:subjectId/topics/:topicId/progress`, `/:subjectId/topics/:topicId/check-history`
- [x] フロントの呼び先を新 API（Learning/View）へ切替
- [x] 削除後の subject route が Curriculum のみになっていることを確認
  - 残るべきエンドポイント: `/`, `/:id`, `/:id/tree`, `/:id/import`, `/study-domains/:domainId`

---

## Phase 5: その他の改善

### E) フィルタ条件の明確化
- [x] `packages/shared/src/schemas/topic.ts` の `hasPostCheckChat` を実装に反映 or スキーマから削除
- [x] `daysSinceLastChat` の名前と実装の意味を一致させる（例: `chatWithinDays` にリネーム）
- [x] フィルタ条件の意味を JSDoc またはドキュメントに明記

### F) トランザクション設計の整理
- [x] `apps/api/src/shared/lib/transaction/drizzle.ts` のコメントを整理し、どの Runner をいつ使うか明確化
- [x] `updateSubjectTree` の dynamic import を除去または理由をドキュメント化
- [x] トランザクション方針をドキュメント化（D1 の制約を含む）

### G) ドキュメント整備
- [x] `README.md` から存在しない `features/topic/` の記述を削除
- [x] `docs/v2` と `docs/v2.1` の関係を整理（どちらが現行か明示）

---

## 完了条件チェックリスト

### 契約の一貫性
- [x] すべての API エラーが `{ error: { code, message, details? } }` 形式
- [x] すべてのレスポンスが shared schema で parse 可能（Contract テスト）

### 境界の安全性
- [x] すべての repository 関数に `userId` が必須引数
- [x] すべての読み取りクエリに `deleted_at IS NULL` 条件
- [x] マルチユーザー境界テストが Learning/View/Bookmark を網羅

### 依存関係
- [x] `subjects` は `learning` / `chat` / `note` に依存しない
- [x] `learning` は `subjects` を参照のみ（書き込み禁止）
- [x] `view` は read-only（書き込みなし）

### パフォーマンス
- [x] View の主要クエリに適切なインデックスが存在
- [x] N+1 クエリが発生していない

---

## 参考リンク

- `docs/v2.1/fb-2.md` - 差分レビュー結果と課題詳細
- `docs/v2.1/subject-slice-plan.md` - ドメイン再編設計書
