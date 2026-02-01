# v2.1 実装タスクリスト

> 設計ドキュメント: [design.md](./design.md)
> 実装ガイド: [implementation-guide.md](./implementation-guide.md)

---

## Phase 1: 基盤（スキーマ・テストヘルパー）

### 1.1 DBスキーマ変更
- [x] `users` テーブルに `deleted_at` カラム追加
- [x] `study_domains` テーブル再作成（`user_id`, `deleted_at` 追加、`is_public` 削除）
- [x] `subjects` テーブル再作成（`user_id`, `deleted_at` 追加）
- [x] `categories` テーブル再作成（`user_id`, `deleted_at` 追加）
- [x] `topics` テーブル再作成（`user_id`, `deleted_at` 追加）
- [x] `user_study_domains` テーブル削除
- [x] インデックス作成（`user_id`, `(user_id, deleted_at)` 複合）

### 1.2 マイグレーション作成
- [x] マイグレーションファイル作成（`0006_v2_1_user_owned_content.sql`）
- [x] 既存データ削除順序の確認（topics → categories → subjects → study_domains）
- [ ] ローカルD1でマイグレーション検証

### 1.3 Drizzleスキーマ更新
- [x] `packages/db/src/schema/studyDomain.ts` 更新
- [x] `packages/db/src/schema/topics.ts` 更新（subjects, categories, topics）
- [x] `packages/db/src/schema/users.ts` に `deletedAt` 追加
- [x] `packages/db/src/schema/userStudyDomain.ts` 削除
- [x] `packages/db/src/schema/index.ts` エクスポート更新

### 1.4 Zodスキーマ更新
- [x] `packages/shared/src/schemas/studyDomain.ts` 更新（userId, deletedAt追加）
- [x] `packages/shared/src/schemas/topic.ts` 更新（userId, deletedAt追加）
- [x] `packages/shared/src/schemas/tree.ts` 作成（ツリー更新リクエスト）
- [x] `packages/shared/src/schemas/index.ts` エクスポート更新

### 1.5 テストヘルパー更新
- [x] `createTestUser` ヘルパー更新
- [x] `createTestStudyDomain` ヘルパー作成（userId必須）
- [x] `createTestSubject` ヘルパー作成（userId必須）
- [x] `createTestCategory` ヘルパー作成（userId必須）
- [x] `createTestTopic` ヘルパー作成（userId必須）

---

## Phase 2: 学習領域 CRUD（TDD）

### 2.1 Repository層
- [x] **テスト**: `findByUserId` - 自分のデータのみ取得
- [x] **テスト**: `findByUserId` - 論理削除されたデータは除外
- [x] **テスト**: `findById` - userIdが一致する場合のみ取得
- [x] **テスト**: `findById` - 他ユーザーのデータはnull
- [x] **テスト**: `findById` - 論理削除されたデータはnull
- [x] **テスト**: `create` - 正常作成
- [x] **テスト**: `update` - 自分のデータのみ更新可能
- [x] **テスト**: `softDelete` - deletedAtが設定される
- [x] **実装**: `apps/api/src/features/study-domain/repository.ts`

### 2.2 UseCase層
- [x] **テスト**: `listStudyDomains` - 自分の学習領域一覧取得
- [x] **テスト**: `getStudyDomain` - 存在しない場合NOT_FOUND
- [x] **テスト**: `createStudyDomain` - 正常作成
- [x] **テスト**: `updateStudyDomain` - 正常更新
- [x] **テスト**: `deleteStudyDomain` - 論理削除
- [x] **実装**: `apps/api/src/features/study-domain/usecase.ts`

### 2.3 Route層
- [x] **テスト**: `GET /api/study-domains` - 認証必須
- [x] **テスト**: `GET /api/study-domains/:id` - 認証必須、NOT_FOUND
- [x] **テスト**: `POST /api/study-domains` - バリデーション、作成成功
- [x] **テスト**: `PATCH /api/study-domains/:id` - 部分更新
- [x] **テスト**: `DELETE /api/study-domains/:id` - 論理削除
- [x] **実装**: `apps/api/src/features/study-domain/route.ts`

---

## Phase 3: 科目 CRUD（TDD）

### 3.1 Repository層
- [x] **テスト**: `findByStudyDomainId` - 自分のデータのみ取得
- [x] **テスト**: `findByStudyDomainId` - 親（学習領域）が論理削除された場合は除外
- [x] **テスト**: `findById` - userIdが一致する場合のみ取得
- [x] **テスト**: `findById` - 論理削除された場合はnull
- [x] **テスト**: `findById` - 親（学習領域）が論理削除された場合はnull
- [x] **テスト**: `create` - 正常作成
- [x] **テスト**: `update` - 自分のデータのみ更新可能
- [x] **テスト**: `softDelete` - deletedAtが設定される
- [x] **実装**: `apps/api/src/features/subject/repository.ts`

### 3.2 UseCase層
- [x] **テスト**: `listSubjects` - 科目一覧取得
- [x] **テスト**: `getSubject` - 存在しない場合NOT_FOUND
- [x] **テスト**: `createSubject` - 正常作成
- [x] **テスト**: `updateSubject` - 正常更新
- [x] **テスト**: `deleteSubject` - 論理削除
- [x] **実装**: `apps/api/src/features/subject/usecase.ts`

### 3.3 Route層
- [x] **テスト**: `GET /api/study-domains/:domainId/subjects` - 認証必須
- [x] **テスト**: `GET /api/subjects/:id` - 認証必須、NOT_FOUND
- [x] **テスト**: `POST /api/study-domains/:domainId/subjects` - バリデーション、作成成功
- [x] **テスト**: `PATCH /api/subjects/:id` - 部分更新
- [x] **テスト**: `DELETE /api/subjects/:id` - 論理削除
- [x] **実装**: `apps/api/src/features/subject/route.ts`

---

## Phase 4: ツリー一括操作 API（TDD）

### 4.1 ツリー取得
- [x] **テスト**: `getSubjectTree` - 科目配下のカテゴリ・トピック取得
- [x] **テスト**: `getSubjectTree` - 論理削除されたノードは除外
- [x] **テスト**: `getSubjectTree` - 他ユーザーの科目はNOT_FOUND
- [x] **実装**: ツリー取得ロジック

### 4.2 ツリー更新（差分更新）
- [x] **テスト**: 新規カテゴリ作成（id: null）
- [x] **テスト**: 新規サブカテゴリ作成（id: null）
- [x] **テスト**: 新規トピック作成（id: null）
- [x] **テスト**: 既存カテゴリ更新（id指定）
- [x] **テスト**: 既存トピック更新（id指定、全フィールド）
- [x] **テスト**: リクエストに含まれないノードはソフト削除
- [x] **テスト**: ソフト削除されたノードの復活（id指定で再追加）
- [x] **テスト**: 他ユーザーのカテゴリIDを含むリクエストはINVALID_ID
- [x] **テスト**: 別科目のカテゴリIDを含むリクエストはINVALID_ID
- [x] **テスト**: 他ユーザーのトピックIDを含むリクエストはINVALID_ID
- [ ] **テスト**: db.batch()による原子性確認
- [x] **実装**: `apps/api/src/features/subject/tree.ts` - `updateSubjectTree`

### 4.3 Route層
- [x] **テスト**: `GET /api/subjects/:id/tree` - 認証必須、ツリー構造返却
- [x] **テスト**: `PUT /api/subjects/:id/tree` - 認証必須、バリデーション
- [x] **テスト**: `PUT /api/subjects/:id/tree` - INVALID_IDエラー時400
- [x] **実装**: Route定義追加

---

## Phase 5: CSVインポート API（TDD）

### 5.1 CSVパーサー（RFC 4180準拠）
- [x] **テスト**: 基本的なCSVパース（3列）
- [x] **テスト**: ヘッダー行スキップ
- [x] **テスト**: 空行スキップ
- [x] **テスト**: ダブルクォートでエスケープされたフィールド
- [x] **テスト**: フィールド内のカンマ
- [x] **テスト**: フィールド内のダブルクォート（""）
- [x] **テスト**: フィールド内の改行
- [x] **テスト**: 列数不足のエラー
- [x] **テスト**: 空フィールドのエラー
- [x] **実装**: `apps/api/src/features/subject/csv-parser.ts`

### 5.2 ツリー変換
- [x] **テスト**: パース結果からツリー構造への変換
- [x] **テスト**: 重複行のマージ
- [x] **テスト**: displayOrderの自動付与
- [x] **実装**: `convertToTree` 関数
- [x] **テスト**: `mergeTree` - 既存ツリーへの追加（同名カテゴリは統合）
- [x] **実装**: `mergeTree` 関数

### 5.3 インポートUseCase
- [x] **テスト**: 正常インポート（追加モード）
- [x] **テスト**: 既存カテゴリへの追加
- [x] **テスト**: パースエラー時の部分成功
- [x] **テスト**: インポート結果の集計
- [x] **テスト**: 科目の所有権確認
- [x] **実装**: `apps/api/src/features/subject/csv-import.ts` - `importCSV`

### 5.4 Route層
- [x] **テスト**: `POST /api/subjects/:id/import` - 認証必須
- [x] **テスト**: `POST /api/subjects/:id/import` - CSVボディ受信
- [x] **テスト**: `POST /api/subjects/:id/import` - エラーレスポンス形式
- [x] **実装**: Route定義追加

---

## Phase 6: フロントエンド

### 6.1 API Client更新
- [x] `apps/web/src/features/study-domain/api.ts` 更新
- [x] `apps/web/src/features/study-domain/hooks/useStudyDomains.ts` 更新
- [x] `apps/web/src/features/subject/api.ts` 作成
- [x] ツリー取得・更新API呼び出し追加
- [x] CSVインポートAPI呼び出し追加

### 6.2 学習領域一覧・作成UI
- [x] `/domains` ルート更新
- [x] 学習領域一覧コンポーネント
- [x] 学習領域作成モーダル
- [ ] 学習領域編集モーダル
- [x] 学習領域削除確認

### 6.3 科目一覧・作成UI
- [x] `/domains/:id/subjects` ルート更新
- [x] 科目一覧コンポーネント
- [x] 科目作成モーダル
- [ ] 科目編集モーダル
- [x] 科目削除確認

### 6.4 ツリーエディタUI
- [ ] `/domains/:id/subjects/:subjectId` ルート作成
- [ ] `TreeEditor.tsx` - コンテナコンポーネント
- [ ] `TreeNode.tsx` - 再帰的ノード表示
- [ ] `TreeNodeEditor.tsx` - インライン編集
- [ ] `TopicDetailEditor.tsx` - 論点詳細編集パネル
- [ ] `AddNodeButton.tsx` - 追加ボタン
- [ ] `useTreeState.ts` - 状態管理フック
- [ ] `useTreeDragDrop.ts` - D&Dロジック（自前実装）
- [ ] 一括保存ボタン・処理

### 6.5 CSVインポートUI
- [ ] CSVインポートボタン
- [ ] ファイル選択ダイアログ
- [ ] インポート結果表示（成功数、エラー一覧）

### 6.6 新規ユーザーサンプル作成
- [ ] `apps/api/src/features/auth/sample-data.ts` 作成
- [ ] `createSampleDataForNewUser` 関数実装
- [ ] `handleOAuthCallback` での呼び出し追加
- [ ] サンプルデータ内容確定

### 6.7 ルーティング更新
- [ ] `routeTree.gen.ts` 更新
- [ ] ヘッダーナビゲーション更新
- [ ] 既存 `/subjects` ルートからのリダイレクト

---

## Phase 7: 統合・E2E

### 7.1 E2Eテスト
- [ ] 新規ユーザー登録 → サンプルデータ確認
- [ ] 学習領域作成 → 科目作成 → ツリー編集 → 保存
- [ ] CSVインポート → ツリー確認
- [ ] 論理削除 → 一覧から消える確認
- [ ] 既存チャット・ノート機能が動作確認
- [ ] 他ユーザーのデータにアクセスできないことを確認（プライバシー）

### 7.2 既存機能との統合
- [ ] チャット機能がユーザー所有のトピックで動作
- [ ] ノート機能がユーザー所有のトピックで動作
- [ ] 進捗表示がユーザー所有のデータで動作
- [ ] 既存の`chatSessions`/`notes`がorphanedになっても保持されることを確認

### 7.3 本番マイグレーション準備
- [ ] 本番D1でのマイグレーション手順書作成
- [ ] ロールバック手順確認
- [ ] 既存ユーザーへの告知文作成

### 7.4 型チェック・リント
- [x] `pnpm check-types` パス
- [ ] `pnpm lint` パス
- [ ] 不要なインポート削除

---

## 完了基準

- [ ] 全テストがパス
- [x] 型エラーがゼロ
- [ ] ユーザーが学習領域を作成できる
- [ ] ユーザーが科目を追加・編集・削除できる
- [ ] ツリーエディタで単元・論点を編集できる
- [ ] CSVインポートが動作する
- [ ] 新規ユーザーにサンプルデータが作成される
- [ ] 論理削除が正しく動作する
- [ ] 既存のチャット・ノート機能が正常に動作する
