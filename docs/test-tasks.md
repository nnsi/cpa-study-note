# テストタスクリスト

## 概要

プロジェクト全体のテスト整備タスク。現状テストが一切ないため、基盤構築から始める。

---

## 1. テスト環境セットアップ

- [ ] Vitest導入（`apps/api`）
- [ ] Vitest導入（`apps/web`）
- [ ] Vitest導入（`packages/shared`）
- [ ] R2モック作成（`apps/api/src/test/mocks/r2.ts` - インメモリMap）
- [ ] CI設定（GitHub Actions）

> **Note:**
> - D1 → オンメモリSQLite（Vitestでbetter-sqlite3使用）
> - AI → 既存のモックレスポンスで対応済み
> - R2 → `put`/`get`のみ使用、インメモリMapで十分

---

## 2. セキュリティ系テスト

### Image機能（`apps/api/src/features/image/`）

- [ ] `sanitizeFilename` - 正常なファイル名
- [ ] `sanitizeFilename` - パストラバーサル攻撃（`../`、`..\\`）
- [ ] `sanitizeFilename` - 特殊文字（`<>:"|?*`、制御文字）
- [ ] `sanitizeFilename` - 空文字・空白のみ
- [ ] `validateMagicBytes` - JPEG形式（正常）
- [ ] `validateMagicBytes` - PNG形式（正常）
- [ ] `validateMagicBytes` - GIF形式（正常）
- [ ] `validateMagicBytes` - WebP形式（正常）
- [ ] `validateMagicBytes` - 偽装ファイル（拡張子とマジックバイト不一致）
- [ ] `validateMagicBytes` - 不正なバイナリ
- [ ] `validateMagicBytes` - 空ファイル
- [ ] `validateMagicBytes` - サイズ超過

---

## 3. Domain層テスト

### Auth Domain（`apps/api/src/features/auth/domain.ts`）

- [ ] `User` 型の検証
- [ ] `UserOAuthConnection` 型の検証
- [ ] `RefreshToken` 型の検証
- [ ] `AuthError` 型の網羅性確認

### Chat Domain

- [ ] `ChatSession` 型の検証
- [ ] `ChatMessage` 型の検証

### Topic Domain

- [ ] `Subject` 型の検証
- [ ] `Category` 型の検証
- [ ] `Topic` 型の検証
- [ ] `TopicProgress` 型の検証

### Note Domain

- [ ] `Note` 型の検証
- [ ] `NoteWithTopic` 型の検証

### Image Domain

- [ ] `ImageMetadata` 型の検証

---

## 4. UseCase層テスト

### Auth UseCase（`apps/api/src/features/auth/usecase.ts`）

- [ ] `handleOAuthCallback` - 新規ユーザー作成フロー
- [ ] `handleOAuthCallback` - 既存ユーザーログインフロー
- [ ] `handleOAuthCallback` - 無効なプロバイダー拒否
- [ ] `handleOAuthCallback` - トークン交換失敗時のエラー
- [ ] `refreshAccessToken` - 正常なトークン更新
- [ ] `refreshAccessToken` - 期限切れトークン拒否
- [ ] `refreshAccessToken` - 不正なトークン拒否

### Chat UseCase（`apps/api/src/features/chat/usecase.ts`）

- [ ] `createSession` - セッション作成
- [ ] `createSession` - 存在しない論点での作成拒否
- [ ] `listSessionsByTopic` - 一覧取得（メッセージ数フィルタリング）
- [ ] `getSession` - 正常取得
- [ ] `getSession` - 他ユーザーのセッションアクセス拒否
- [ ] `listMessages` - メッセージ一覧取得
- [ ] `listMessages` - 他ユーザーのセッションアクセス拒否
- [ ] `sendMessage` - メッセージ保存
- [ ] `sendMessage` - AI呼び出し・ストリーミング
- [ ] `sendMessage` - 進捗更新
- [ ] `sendMessageWithNewSession` - セッション作成と同時送信
- [ ] `evaluateQuestion` - good判定
- [ ] `evaluateQuestion` - surface判定

### Topic UseCase（`apps/api/src/features/topic/usecase.ts`）

- [ ] `listSubjects` - 科目一覧取得（カテゴリ数・論点数含む）
- [ ] `getSubject` - 科目詳細取得
- [ ] `getSubject` - 存在しない科目でのエラー
- [ ] `listCategoriesHierarchy` - 階層構造構築
- [ ] `listCategoriesHierarchy` - ユーザー進捗含む
- [ ] `listTopicsByCategory` - カテゴリ内論点一覧
- [ ] `getTopicWithProgress` - 論点詳細取得
- [ ] `getTopicWithProgress` - アクセス記録更新
- [ ] `updateProgress` - 理解フラグ更新（understood）
- [ ] `updateProgress` - 理解フラグ更新（struggling）
- [ ] `listUserProgress` - 全進捗取得
- [ ] `getSubjectProgressStats` - 科目別統計計算

### Note UseCase（`apps/api/src/features/note/usecase.ts`）

- [ ] `createNoteFromSession` - 会話からの要約生成
- [ ] `createNoteFromSession` - 空セッションでのエラー
- [ ] `listNotes` - ユーザーのノート一覧
- [ ] `listNotesByTopic` - 論点別ノート一覧
- [ ] `getNote` - ノート詳細取得
- [ ] `getNote` - 他ユーザーのノートアクセス拒否
- [ ] `updateNote` - メモ更新
- [ ] `updateNote` - 重要ポイント更新
- [ ] `updateNote` - つまずきポイント更新

### Image UseCase（`apps/api/src/features/image/usecase.ts`）

- [ ] `createUploadUrl` - 署名付きURL生成
- [ ] `uploadImage` - 正常アップロード
- [ ] `uploadImage` - 不正形式拒否
- [ ] `performOCR` - OCRテキスト取得・保存
- [ ] `getImage` - メタデータ取得
- [ ] `getImage` - 他ユーザーの画像アクセス拒否

---

## 5. Repository層テスト

### Auth Repository（`apps/api/src/features/auth/repository.ts`）

- [ ] `findUserById` - 正常取得
- [ ] `findUserById` - 存在しないユーザー
- [ ] `findUserByEmail` - 正常取得
- [ ] `createUser` - ユーザー作成
- [ ] `findConnectionByProviderAndId` - OAuth接続検索
- [ ] `createConnection` - OAuth接続作成
- [ ] `saveRefreshToken` - トークン保存
- [ ] `findRefreshTokenByHash` - トークン検索
- [ ] `deleteRefreshToken` - トークン削除
- [ ] `deleteAllUserRefreshTokens` - 全トークン削除

### Chat Repository（`apps/api/src/features/chat/repository.ts`）

- [ ] `createSession` - セッション作成
- [ ] `findSessionById` - セッション取得
- [ ] `findSessionsByTopic` - 論点別セッション一覧
- [ ] `getSessionMessageCount` - メッセージ数カウント
- [ ] `createMessage` - メッセージ作成
- [ ] `findMessageById` - メッセージ取得
- [ ] `findMessagesBySession` - セッション内メッセージ一覧
- [ ] `updateMessageQuality` - 質問品質更新

### Topic Repository（`apps/api/src/features/topic/repository.ts`）

- [ ] `findAllSubjects` - 全科目取得
- [ ] `findSubjectById` - 科目取得
- [ ] `findCategoriesBySubject` - 科目内カテゴリ取得
- [ ] `findTopicsByCategory` - カテゴリ内論点取得
- [ ] `findTopicById` - 論点取得
- [ ] `findProgressByUserAndTopic` - 進捗取得
- [ ] `upsertProgress` - 進捗作成/更新
- [ ] `findProgressByUser` - ユーザー全進捗取得
- [ ] `getSubjectStats` - 科目統計取得

### Note Repository（`apps/api/src/features/note/repository.ts`）

- [ ] `create` - ノート作成
- [ ] `findById` - ノート取得
- [ ] `findByIdWithTopic` - トピック情報付き取得
- [ ] `findByTopic` - 論点別ノート取得
- [ ] `findByUser` - ユーザー別ノート取得
- [ ] `update` - ノート更新

### Image Repository（`apps/api/src/features/image/repository.ts`）

- [ ] `create` - メタデータ作成
- [ ] `findById` - メタデータ取得
- [ ] `updateOcrText` - OCRテキスト更新

---

## 6. 統合テスト（API Routes）

### Auth Routes（`apps/api/src/features/auth/route.ts`）

- [ ] `GET /auth/:provider` - OAuth開始リダイレクト
- [ ] `GET /auth/:provider/callback` - コールバック処理
- [ ] `POST /auth/refresh` - トークン更新
- [ ] `POST /auth/logout` - ログアウト
- [ ] `GET /auth/me` - 現在のユーザー取得
- [ ] 認証エラー時の401レスポンス

### Chat Routes（`apps/api/src/features/chat/route.ts`）

- [ ] `POST /topics/:topicId/sessions` - セッション作成
- [ ] `GET /topics/:topicId/sessions` - セッション一覧
- [ ] `GET /sessions/:sessionId` - セッション詳細
- [ ] `GET /sessions/:sessionId/messages` - メッセージ一覧
- [ ] `POST /sessions/:sessionId/messages` - メッセージ送信（SSE）
- [ ] `POST /sessions/:sessionId/messages/:messageId/evaluate` - 質問評価
- [ ] 未認証時の401レスポンス
- [ ] 他ユーザーリソースへの403レスポンス

### Topic Routes（`apps/api/src/features/topic/route.ts`）

- [ ] `GET /subjects` - 科目一覧
- [ ] `GET /subjects/:subjectId` - 科目詳細
- [ ] `GET /subjects/:subjectId/categories` - カテゴリ階層
- [ ] `GET /categories/:categoryId/topics` - 論点一覧
- [ ] `GET /topics/:topicId` - 論点詳細
- [ ] `PUT /topics/:topicId/progress` - 進捗更新
- [ ] `GET /progress` - 全進捗取得
- [ ] `GET /progress/stats` - 進捗統計

### Note Routes（`apps/api/src/features/note/route.ts`）

- [ ] `POST /sessions/:sessionId/notes` - ノート作成
- [ ] `GET /notes` - ノート一覧
- [ ] `GET /topics/:topicId/notes` - 論点別ノート一覧
- [ ] `GET /notes/:noteId` - ノート詳細
- [ ] `PATCH /notes/:noteId` - ノート更新
- [ ] 未認証時の401レスポンス
- [ ] 他ユーザーリソースへの403レスポンス

### Image Routes（`apps/api/src/features/image/route.ts`）

- [ ] `POST /images/upload-url` - アップロードURL取得
- [ ] `POST /images` - 画像アップロード
- [ ] `POST /images/:imageId/ocr` - OCR実行
- [ ] `GET /images/:imageId` - 画像メタデータ取得
- [ ] 未認証時の401レスポンス
- [ ] 他ユーザーリソースへの403レスポンス

---

## 7. E2Eテスト

### 認証フロー

- [ ] Google OAuth開始 → コールバック → トークン取得
- [ ] トークンリフレッシュ → 新トークン取得
- [ ] ログアウト → トークン無効化確認

### 学習フロー

- [ ] 科目一覧取得 → カテゴリ選択 → 論点選択
- [ ] 論点ページ表示 → 進捗更新
- [ ] 進捗統計の正確性確認

### チャットフロー

- [ ] セッション作成 → メッセージ送信 → AI応答受信
- [ ] 連続メッセージ送信 → 会話履歴確認
- [ ] 質問評価 → 品質ラベル付与

### ノートフロー

- [ ] チャット実施 → ノート作成 → 要約確認
- [ ] ノート編集 → 保存 → 再取得確認

### 画像フロー

- [ ] 画像アップロード → OCR実行 → テキスト取得
- [ ] チャットに画像添付 → OCR結果をコンテキストに含める

---

## 8. Frontend テスト

### Chat Logic（`apps/web/src/features/chat/logic.ts`）

- [ ] `filterMessagesByRole` - userのみフィルタ
- [ ] `filterMessagesByRole` - assistantのみフィルタ
- [ ] `countQuestionQuality` - good/surfaceカウント
- [ ] `formatMessagesForDisplay` - タイムゾーン変換
- [ ] `formatMessagesForDisplay` - 空配列

### Chat Hooks（`apps/web/src/features/chat/hooks.ts`）

- [ ] `useSendMessage` - 送信開始→ストリーミング→完了
- [ ] `useSendMessage` - エラー時の状態
- [ ] `useChatInput` - 入力値管理
- [ ] `useChatInput` - 画像添付

### Image Hooks（`apps/web/src/features/image/hooks.ts`）

- [ ] `useImageUpload` - 状態遷移（idle→uploading→processing→done）
- [ ] `useImageUpload` - エラー時の状態遷移
- [ ] MIME型チェック - 許可形式
- [ ] MIME型チェック - 非許可形式拒否

### Progress Hooks（`apps/web/src/features/progress/hooks.ts`）

- [ ] `useProgress` - 完了率計算
- [ ] `useProgress` - 科目別集計

---

## 進捗サマリー

| カテゴリ | 完了 | 合計 |
|---------|------|------|
| 環境セットアップ | 0 | 5 |
| セキュリティ | 0 | 12 |
| Domain | 0 | 12 |
| UseCase | 0 | 38 |
| Repository | 0 | 31 |
| 統合テスト | 0 | 35 |
| E2Eテスト | 0 | 14 |
| Frontend | 0 | 16 |
| **合計** | **0** | **163** |
