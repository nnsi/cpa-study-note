# v2.1 実装タスクリスト

> 設計ドキュメント: [design.md](./design.md)
> 実装ガイド: [implementation-guide.md](./implementation-guide.md)

---

## Phase 1: 基盤（スキーマ・テストヘルパー）

### 1.1 DBスキーマ変更
- [ ] `users` テーブルに `deleted_at` カラム追加
- [ ] `study_domains` テーブル再作成（`user_id`, `deleted_at` 追加、`is_public` 削除）
- [ ] `subjects` テーブル再作成（`user_id`, `deleted_at` 追加）
- [ ] `categories` テーブル再作成（`user_id`, `deleted_at` 追加）
- [ ] `topics` テーブル再作成（`user_id`, `deleted_at` 追加）
- [ ] `user_study_domains` テーブル削除
- [ ] インデックス作成（`user_id`, `(user_id, deleted_at)` 複合）

### 1.2 マイグレーション作成
- [ ] マイグレーションファイル作成（`drizzle-kit generate`）
- [ ] 既存データ削除順序の確認（topics → categories → subjects → study_domains）
- [ ] ローカルD1でマイグレーション検証

### 1.3 Drizzleスキーマ更新
- [ ] `packages/db/src/schema/studyDomain.ts` 更新
- [ ] `packages/db/src/schema/topics.ts` 更新（subjects, categories, topics）
- [ ] `packages/db/src/schema/users.ts` に `deletedAt` 追加
- [ ] `packages/db/src/schema/userStudyDomain.ts` 削除
- [ ] `packages/db/src/schema/index.ts` エクスポート更新

### 1.4 Zodスキーマ更新
- [ ] `packages/shared/src/schemas/studyDomain.ts` 更新（userId, deletedAt追加）
- [ ] `packages/shared/src/schemas/subject.ts` 作成
- [ ] `packages/shared/src/schemas/tree.ts` 作成（ツリー更新リクエスト）
- [ ] `packages/shared/src/schemas/index.ts` エクスポート更新

### 1.5 テストヘルパー更新
- [ ] `createTestUser` ヘルパー更新
- [ ] `createTestStudyDomain` ヘルパー作成（userId必須）
- [ ] `createTestSubject` ヘルパー作成（userId必須）
- [ ] `createTestCategory` ヘルパー作成（userId必須）
- [ ] `createTestTopic` ヘルパー作成（userId必須）

---

## Phase 2: 学習領域 CRUD（TDD）

### 2.1 Repository層
- [ ] **テスト**: `findByUserId` - 自分のデータのみ取得
- [ ] **テスト**: `findByUserId` - 論理削除されたデータは除外
- [ ] **テスト**: `findById` - userIdが一致する場合のみ取得
- [ ] **テスト**: `findById` - 他ユーザーのデータはnull
- [ ] **テスト**: `findById` - 論理削除されたデータはnull
- [ ] **テスト**: `create` - 正常作成
- [ ] **テスト**: `update` - 自分のデータのみ更新可能
- [ ] **テスト**: `softDelete` - deletedAtが設定される
- [ ] **実装**: `apps/api/src/features/study-domain/repository.ts`

### 2.2 UseCase層
- [ ] **テスト**: `listStudyDomains` - 自分の学習領域一覧取得
- [ ] **テスト**: `getStudyDomain` - 存在しない場合NOT_FOUND
- [ ] **テスト**: `createStudyDomain` - 正常作成
- [ ] **テスト**: `updateStudyDomain` - 正常更新
- [ ] **テスト**: `deleteStudyDomain` - 論理削除
- [ ] **実装**: `apps/api/src/features/study-domain/usecase.ts`

### 2.3 Route層
- [ ] **テスト**: `GET /api/study-domains` - 認証必須
- [ ] **テスト**: `GET /api/study-domains/:id` - 認証必須、NOT_FOUND
- [ ] **テスト**: `POST /api/study-domains` - バリデーション、作成成功
- [ ] **テスト**: `PATCH /api/study-domains/:id` - 部分更新
- [ ] **テスト**: `DELETE /api/study-domains/:id` - 論理削除
- [ ] **実装**: `apps/api/src/features/study-domain/route.ts`

---

## Phase 3: 科目 CRUD（TDD）

### 3.1 Repository層
- [ ] **テスト**: `findByStudyDomainId` - 自分のデータのみ取得
- [ ] **テスト**: `findByStudyDomainId` - 親（学習領域）が論理削除された場合は除外
- [ ] **テスト**: `findById` - userIdが一致する場合のみ取得
- [ ] **テスト**: `findById` - 論理削除された場合はnull
- [ ] **テスト**: `findById` - 親（学習領域）が論理削除された場合はnull
- [ ] **テスト**: `create` - 正常作成
- [ ] **テスト**: `update` - 自分のデータのみ更新可能
- [ ] **テスト**: `softDelete` - deletedAtが設定される
- [ ] **実装**: `apps/api/src/features/subject/repository.ts`

### 3.2 UseCase層
- [ ] **テスト**: `listSubjects` - 科目一覧取得
- [ ] **テスト**: `getSubject` - 存在しない場合NOT_FOUND
- [ ] **テスト**: `createSubject` - 正常作成
- [ ] **テスト**: `updateSubject` - 正常更新
- [ ] **テスト**: `deleteSubject` - 論理削除
- [ ] **実装**: `apps/api/src/features/subject/usecase.ts`

### 3.3 Route層
- [ ] **テスト**: `GET /api/study-domains/:domainId/subjects` - 認証必須
- [ ] **テスト**: `GET /api/subjects/:id` - 認証必須、NOT_FOUND
- [ ] **テスト**: `POST /api/study-domains/:domainId/subjects` - バリデーション、作成成功
- [ ] **テスト**: `PATCH /api/subjects/:id` - 部分更新
- [ ] **テスト**: `DELETE /api/subjects/:id` - 論理削除
- [ ] **実装**: `apps/api/src/features/subject/route.ts`

---

## Phase 4: ツリー一括操作 API（TDD）

### 4.1 ツリー取得
- [ ] **テスト**: `getSubjectTree` - 科目配下のカテゴリ・トピック取得
- [ ] **テスト**: `getSubjectTree` - 論理削除されたノードは除外
- [ ] **テスト**: `getSubjectTree` - 他ユーザーの科目はNOT_FOUND
- [ ] **実装**: ツリー取得ロジック

### 4.2 ツリー更新（差分更新）
- [ ] **テスト**: 新規カテゴリ作成（id: null）
- [ ] **テスト**: 新規サブカテゴリ作成（id: null）
- [ ] **テスト**: 新規トピック作成（id: null）
- [ ] **テスト**: 既存カテゴリ更新（id指定）
- [ ] **テスト**: 既存トピック更新（id指定、全フィールド）
- [ ] **テスト**: リクエストに含まれないノードはソフト削除
- [ ] **テスト**: ソフト削除されたノードの復活（id指定で再追加）
- [ ] **テスト**: 他ユーザーのカテゴリIDを含むリクエストはINVALID_ID
- [ ] **テスト**: 別科目のカテゴリIDを含むリクエストはINVALID_ID
- [ ] **テスト**: 他ユーザーのトピックIDを含むリクエストはINVALID_ID
- [ ] **テスト**: db.batch()による原子性確認
- [ ] **実装**: `apps/api/src/features/subject/usecase.ts` - `updateSubjectTree`

### 4.3 Route層
- [ ] **テスト**: `GET /api/subjects/:id/tree` - 認証必須、ツリー構造返却
- [ ] **テスト**: `PUT /api/subjects/:id/tree` - 認証必須、バリデーション
- [ ] **テスト**: `PUT /api/subjects/:id/tree` - INVALID_IDエラー時400
- [ ] **実装**: Route定義追加

---

## Phase 5: CSVインポート API（TDD）

### 5.1 CSVパーサー（RFC 4180準拠）
- [ ] **テスト**: 基本的なCSVパース（3列）
- [ ] **テスト**: ヘッダー行スキップ
- [ ] **テスト**: 空行スキップ
- [ ] **テスト**: ダブルクォートでエスケープされたフィールド
- [ ] **テスト**: フィールド内のカンマ
- [ ] **テスト**: フィールド内のダブルクォート（""）
- [ ] **テスト**: フィールド内の改行
- [ ] **テスト**: 列数不足のエラー
- [ ] **テスト**: 空フィールドのエラー
- [ ] **実装**: `apps/api/src/features/subject/csv-parser.ts`

### 5.2 ツリー変換
- [ ] **テスト**: パース結果からツリー構造への変換
- [ ] **テスト**: 重複行のマージ
- [ ] **テスト**: displayOrderの自動付与
- [ ] **実装**: `convertToTree` 関数
- [ ] **テスト**: `mergeTree` - 既存ツリーへの追加（同名カテゴリは統合）
- [ ] **実装**: `mergeTree` 関数

### 5.3 インポートUseCase
- [ ] **テスト**: 正常インポート（追加モード）
- [ ] **テスト**: 既存カテゴリへの追加
- [ ] **テスト**: パースエラー時の部分成功
- [ ] **テスト**: インポート結果の集計
- [ ] **テスト**: 科目の所有権確認
- [ ] **実装**: `apps/api/src/features/subject/usecase.ts` - `importCSV`

### 5.4 Route層
- [ ] **テスト**: `POST /api/subjects/:id/import` - 認証必須
- [ ] **テスト**: `POST /api/subjects/:id/import` - CSVボディ受信
- [ ] **テスト**: `POST /api/subjects/:id/import` - エラーレスポンス形式
- [ ] **実装**: Route定義追加

---

## Phase 6: フロントエンド

### 6.1 API Client更新
- [ ] `apps/web/src/features/study-domain/api.ts` 作成
- [ ] `apps/web/src/features/subject/api.ts` 作成
- [ ] ツリー取得・更新API呼び出し追加
- [ ] CSVインポートAPI呼び出し追加

### 6.2 学習領域一覧・作成UI
- [ ] `/domains` ルート作成
- [ ] 学習領域一覧コンポーネント
- [ ] 学習領域作成モーダル
- [ ] 学習領域編集モーダル
- [ ] 学習領域削除確認

### 6.3 科目一覧・作成UI
- [ ] `/domains/:id/subjects` ルート作成
- [ ] 科目一覧コンポーネント
- [ ] 科目作成モーダル
- [ ] 科目編集モーダル
- [ ] 科目削除確認

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
- [ ] `pnpm check-types` パス
- [ ] `pnpm lint` パス
- [ ] 不要なインポート削除

---

## 完了基準

- [ ] 全テストがパス
- [ ] 型エラーがゼロ
- [ ] ユーザーが学習領域を作成できる
- [ ] ユーザーが科目を追加・編集・削除できる
- [ ] ツリーエディタで単元・論点を編集できる
- [ ] CSVインポートが動作する
- [ ] 新規ユーザーにサンプルデータが作成される
- [ ] 論理削除が正しく動作する
- [ ] 既存のチャット・ノート機能が正常に動作する
