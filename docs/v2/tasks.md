# v2 実装タスクリスト

> 設計ドキュメント: [design.md](./design.md) / [implementation-guide.md](./implementation-guide.md)

---

## Phase 1: 基盤構築 (P0)

### 1.1 DBスキーマ追加

- [ ] `packages/db/src/schema/studyDomain.ts` 作成
  - [ ] `studyDomains` テーブル定義（id, name, description, emoji, color, isPublic, createdAt, updatedAt）
  - [ ] `isPublic` のデフォルト値を `true` に設定
- [ ] `packages/db/src/schema/userStudyDomain.ts` 作成
  - [ ] `userStudyDomains` テーブル定義（id, userId, studyDomainId, joinedAt）
  - [ ] `(userId, studyDomainId)` の複合ユニーク制約
- [ ] `packages/db/src/schema/topics.ts` 修正
  - [ ] `subjects` に `studyDomainId` カラム追加（NOT NULL, FK → studyDomains）
  - [ ] `subjects.studyDomainId` に `onDelete: "restrict"` を設定（誤削除防止）
  - [ ] `subjects` に `emoji`, `color` カラム追加
  - [ ] `subjects` に `displayOrder` が既存であることを確認
  - [ ] `name` の UNIQUE 制約を `(studyDomainId, name)` の複合ユニーク制約に変更
- [ ] `packages/db/src/schema/users.ts` 修正
  - [ ] `defaultStudyDomainId` カラム追加（オプション, FK → studyDomains）
  - [ ] `defaultStudyDomainId` に `onDelete: "set null"` を設定
- [ ] `packages/db/src/schema/index.ts` でエクスポート追加

### 1.2 マイグレーション作成・適用

- [ ] マイグレーションファイル作成
  - [ ] Step 1: `study_domains` テーブル作成（`is_public` DEFAULT 1 を含む）
  - [ ] Step 2: `user_study_domains` テーブル作成 + インデックス（user_id, study_domain_id）
  - [ ] Step 3: デフォルト学習領域 `cpa` の INSERT
  - [ ] Step 4: `subjects` テーブル再作成（新スキーマ + データ移行）
    - [ ] `study_domain_id` カラム追加（NOT NULL, FK, ON DELETE RESTRICT）
    - [ ] `emoji`, `color` カラム追加
    - [ ] 既存データの `emoji`, `color` をCASEマッピングで移行（財務会計論→📘/blue 等）
    - [ ] `(study_domain_id, name)` の複合ユニーク制約追加
    - [ ] `study_domain_id` にインデックス作成（パフォーマンス対策）
  - [ ] Step 5: `users` に `default_study_domain_id` 追加（ON DELETE SET NULL）
  - [ ] Step 6: 既存ユーザーを `cpa` に紐付け（user_study_domains INSERT）
- [ ] ロールバックSQL準備
- [ ] ローカル環境でマイグレーション実行・検証

### 1.3 Zodスキーマ更新

- [ ] `packages/shared/src/schemas/studyDomain.ts` 作成
  - [ ] `studyDomainSchema` 定義
  - [ ] `createStudyDomainSchema`, `updateStudyDomainSchema` 定義
- [ ] `packages/shared/src/schemas/topic.ts` 修正
  - [ ] `subjectSchema` に `studyDomainId`, `emoji`, `color` 追加
- [ ] `packages/shared/src/schemas/user.ts` 修正
  - [ ] `userSchema` に `defaultStudyDomainId` 追加
- [ ] `packages/shared/src/schemas/index.ts` でエクスポート追加

### 1.4 定数定義

- [ ] `packages/shared/src/constants.ts` 作成
  - [ ] `DEFAULT_STUDY_DOMAIN_ID = "cpa"` 定義
- [ ] `packages/shared/src/index.ts` でエクスポート追加

---

## Phase 2: API実装 (P1)

### 2.1 study-domain feature 作成

- [ ] `apps/api/src/features/study-domain/` ディレクトリ作成
- [ ] `repository.ts` 作成
  - [ ] `findAllPublic()` - 公開学習領域一覧取得
  - [ ] `findById()` - 学習領域詳細取得
  - [ ] `create()` - 学習領域作成
  - [ ] `update()` - 学習領域更新
  - [ ] `remove()` - 学習領域削除
  - [ ] `canDeleteStudyDomain()` - 削除可否チェック（参照整合性）
  - [ ] `findByUserId()` - ユーザー参加中の学習領域一覧
  - [ ] `joinDomain()` - 学習領域参加
  - [ ] `leaveDomain()` - 学習領域離脱（user_study_domainsのみ削除、学習履歴は保持）
- [ ] `usecase.ts` 作成
  - [ ] 各リポジトリ操作に対応するユースケース
  - [ ] `leaveDomain` では学習履歴（userTopicProgress, chatSessions, notes等）を保持
- [ ] `route.ts` 作成
  - [ ] `GET /api/study-domains` - 公開学習領域一覧
  - [ ] `GET /api/study-domains/:id` - 学習領域詳細
  - [ ] `POST /api/study-domains` - 学習領域作成（管理者のみ）
  - [ ] `PATCH /api/study-domains/:id` - 学習領域更新（管理者のみ）
  - [ ] `DELETE /api/study-domains/:id` - 学習領域削除（管理者のみ）
  - [ ] `GET /api/me/study-domains` - 参加中の学習領域一覧
  - [ ] `POST /api/me/study-domains/:id/join` - 学習領域に参加
  - [ ] `DELETE /api/me/study-domains/:id/leave` - 学習領域から離脱
- [ ] 権限制御の実装
  - [ ] 学習領域の作成・更新・削除は当面管理者のみ
  - [ ] 管理者判定ロジックの実装（または将来実装のTODOコメント）
- [ ] `index.ts` でルートエクスポート
- [ ] `apps/api/src/index.ts` にルート登録

### 2.2 既存API拡張

- [ ] `apps/api/src/features/topic/` 修正
  - [ ] `DEFAULT_STUDY_DOMAIN_ID` 定数をインポート
  - [ ] `resolveStudyDomainId()` ロジック実装
    - [ ] 1. クエリパラメータの `studyDomainId` を優先
    - [ ] 2. ユーザーの `defaultStudyDomainId` を使用
    - [ ] 3. `DEFAULT_STUDY_DOMAIN_ID` にフォールバック
  - [ ] `GET /api/subjects` に `studyDomainId` クエリパラメータ対応
  - [ ] Subject レスポンスに `studyDomainId`, `emoji`, `color` 追加
- [ ] `GET /api/study-domains/:id/subjects` エンドポイント追加（オプション）

### 2.3 プロンプト汎用化

- [ ] `apps/api/src/features/chat/domain/sanitize.ts` 作成
  - [ ] `sanitizeForPrompt()` 関数実装（改行除去、長さ制限、Unicode正規化）
- [ ] `apps/api/src/features/chat/domain/prompts.ts` 修正
  - [ ] `buildSecurityInstructions(studyDomainName, subjectName)` に変更
  - [ ] `buildSystemPrompt({ studyDomainName, subjectName, topicName, customPrompt })` に変更
- [ ] `apps/api/src/features/chat/repository.ts` 修正
  - [ ] `getTopicWithHierarchy()` 関数追加（topics → categories → subjects → studyDomains JOIN）
  - [ ] `TopicWithHierarchy` 型定義
- [ ] `apps/api/src/features/chat/usecase.ts` 修正
  - [ ] 階層情報取得処理追加（`getTopicWithHierarchy` 呼び出し）
  - [ ] `buildSystemPrompt` 呼び出し箇所修正（2箇所: 行103付近、行312付近）
  - [ ] モックを `mockImplementation` に変更してシグネチャ変更に対応

---

## Phase 3: フロントエンド対応

### 3.1 科目表示の動的化 (P1)

- [ ] `apps/web/src/lib/colorClasses.ts` 作成
  - [ ] `bgColorClasses` マッピング定義
  - [ ] `getColorClass()` 関数実装
- [ ] `apps/web/src/routes/subjects/index.tsx` 修正
  - [ ] ハードコードされた `getSubjectEmoji()` 削除
  - [ ] ハードコードされた `getSubjectColor()` 削除
  - [ ] API レスポンスの `emoji`, `color` を使用

### 3.2 ルーティング変更 (P1)

- [ ] 下位互換リダイレクト設定
  - [ ] `/subjects` → `/domains/cpa/subjects` リダイレクト
  - [ ] `/subjects/:subjectId` → `/domains/cpa/subjects/:subjectId` リダイレクト
  - [ ] `/subjects/:subjectId/:categoryId` → `/domains/cpa/subjects/:subjectId/:categoryId` リダイレクト
  - [ ] `/subjects/:subjectId/:categoryId/:topicId` → `/domains/cpa/subjects/:subjectId/:categoryId/:topicId` リダイレクト
- [ ] 既存ルート内のリンク更新
  - [ ] `apps/web/src/routes/subjects/` 配下のリンク（`Link to` props）を `/domains/$domainId` ベースに更新
  - [ ] `apps/web/src/components/layout/` のナビゲーション（Header, Sidebar）内のリンク更新
- [ ] 新規ルート作成
  - [ ] `apps/web/src/routes/domains/$domainId/` ディレクトリ作成
  - [ ] `apps/web/src/routes/domains/$domainId/subjects/index.tsx`
    - [ ] ローダーで `studyDomainId` を使用してAPI呼び出し
  - [ ] `apps/web/src/routes/domains/$domainId/subjects/$subjectId/index.tsx`
    - [ ] ローダーで `studyDomainId` を使用してAPI呼び出し
  - [ ] `apps/web/src/routes/domains/$domainId/subjects/$subjectId/$categoryId/index.tsx`
    - [ ] ローダーで `studyDomainId` を使用してAPI呼び出し
  - [ ] `apps/web/src/routes/domains/$domainId/subjects/$subjectId/$categoryId/$topicId/index.tsx`
    - [ ] ローダーで `studyDomainId` を使用してAPI呼び出し

### 3.3 学習領域選択UI (P2)

- [ ] `apps/web/src/features/study-domain/` ディレクトリ作成
- [ ] `hooks/useCurrentDomain.ts` 作成
- [ ] `hooks/useUserStudyDomains.ts` 作成
- [ ] `components/DomainSelector.tsx` 作成（ヘッダー用セレクタ）
- [ ] `apps/web/src/routes/__root.tsx` 修正
  - [ ] 学習領域セレクタをヘッダーに追加

### 3.4 学習領域一覧ページ (P2)

- [ ] `apps/web/src/routes/domains/index.tsx` 作成
  - [ ] 公開学習領域一覧表示
  - [ ] 「他の学習領域を追加」導線
- [ ] 参加/離脱機能実装

---

## Phase 4: シードデータ・テスト (P0/P1)

### 4.1 シードデータ形式変更 (P1)

- [ ] `packages/db/data/study-domains/` ディレクトリ作成
- [ ] `packages/db/data/study-domains/cpa/domain.json` 作成
- [ ] `packages/db/data/study-domains/cpa/subjects/` ディレクトリ作成
  - [ ] `financial.json` (財務会計論)
  - [ ] `management.json` (管理会計論)
  - [ ] `audit.json` (監査論)
  - [ ] `corporate-law.json` (企業法)
  - [ ] `tax.json` (租税法)
  - [ ] `management-studies.json` (経営学)
  - [ ] `economics.json` (経済学)
  - [ ] `civil-law.json` (民法)
- [ ] `packages/db/scripts/seed.ts` 修正
  - [ ] 新形式に対応したシードロジック実装

### 4.2 テスト修正 (P0)

- [ ] `apps/api/src/features/chat/usecase.test.ts` 修正
  - [ ] `buildSystemPrompt` のシグネチャ変更対応
  - [ ] `vi.mock` の `buildSystemPrompt` を `mockImplementation` に変更
  - [ ] モックが新しいシグネチャ（`{ studyDomainName, subjectName, topicName }`）を受け取ることを確認
  - [ ] モックデータに `studyDomain` (hierarchy) を追加
- [ ] `apps/api/src/features/chat/route.test.ts` 修正
  - [ ] モックデータに `studyDomain` 追加
- [ ] `apps/api/src/features/study-domain/*.test.ts` 新規作成
  - [ ] 学習領域 CRUD テスト
  - [ ] 参加/離脱テスト
  - [ ] 離脱時に学習履歴（userTopicProgress, chatSessions, notes等）が保持されることをテスト
  - [ ] 参照整合性チェックテスト（科目がある学習領域は削除不可）

### 4.3 E2Eテスト (P0)

- [ ] マイグレーションテスト
  - [ ] staging 環境でマイグレーション実行
  - [ ] 全 API エンドポイントの動作確認
  - [ ] 既存ユーザーのデータ整合性確認
  - [ ] パフォーマンステスト（インデックス効果確認）
- [ ] 機能テスト
  - [ ] 既存機能の動作確認（科目一覧、チャット、ノート等）
  - [ ] 新機能の動作確認（学習領域選択、切り替え）
  - [ ] 学習領域離脱後に学習履歴が保持されていることを確認

---

## Phase 5: 検証・リリース

### 5.1 技術的成功基準チェック

- [ ] 既存ユーザーのデータが完全に維持されている
- [ ] 既存の全機能が正常に動作する
- [ ] 新規学習領域（簿記2級など）を追加できる
- [ ] 型エラーがゼロ
- [ ] E2Eテストが全パス

### 5.2 思想の維持チェック

- [ ] 「判断しない」: 理解度評価を追加していない
- [ ] 「論点中心」: 新構造でも論点が中心にある
- [ ] 「痕跡を残す」: 学習履歴が学習領域を跨いでも保持される
- [ ] 「気づきの材料」: 事実ベースの表示を維持

---

## 補足: 並列実行可能なタスク

以下は他タスクと並行して進められる:

- `colorClasses.ts` の作成（Phase 1 と並行可能）
- ルーティング設計・実装（Phase 2 API完了を待たず開始可能）

---

## 変更影響範囲サマリ

| 領域 | ファイル数 | 影響度 |
|------|-----------|--------|
| DBスキーマ | 4 | 高 |
| マイグレーション | 1 | 高 |
| Zodスキーマ | 4 | 中 |
| API新規 | 4 | - |
| API修正 | 4 | 高 |
| フロントエンド新規 | 8+ | - |
| フロントエンド修正 | 3 | 中〜高 |
| テスト | 5+ | 中 |
