# 動作確認チェックリスト

## 修正した問題

1. **apps/api/package.json** - `zod`依存関係追加
2. **apps/web/package.json** - `zustand`, `@tanstack/router-devtools`依存関係追加
3. **apps/web/.env.development** - `VITE_API_URL`環境変数設定
4. **apps/api/wrangler.toml** - `API_BASE_URL`, `WEB_BASE_URL`環境変数追加
5. **apps/api/src/features/auth/route.ts** - `/me`ルートの順序修正（`/:provider`より前に配置）
6. **apps/api/wrangler.toml** - `migrations_dir`設定追加
7. **packages/db/scripts/seed.ts** - カラム名をsnake_caseに修正、バッチサイズ制限追加
8. **apps/web/src/features/chat/api.ts** - SSEストリーミング対応（Hono RPCからfetch直接使用に変更）
9. **apps/api/src/features/chat/usecase.ts** - doneチャンクをメッセージ保存後に送信するよう修正

---

## API動作確認 (curl)

### Health
- [x] GET /api/health - ヘルスチェック ✓

### Auth
- [x] GET /api/auth/providers - プロバイダー一覧取得 ✓
- [x] GET /api/auth/me - ユーザー情報取得（dev modeでテストユーザー返却）✓
- [x] POST /api/auth/logout - ログアウト ✓

### Topics (Subjects)
- [x] GET /api/subjects - 科目一覧取得（8科目）✓
- [x] GET /api/subjects/:subjectId - 科目詳細取得 ✓
- [x] GET /api/subjects/:subjectId - 存在しないID→404 ✓
- [x] GET /api/subjects/:subjectId/categories - カテゴリ一覧取得 ✓
- [x] GET /api/subjects/:subjectId/categories/:categoryId/topics - 論点一覧取得 ✓
- [x] GET /api/subjects/progress/me - ユーザー進捗取得 ✓

### Chat
- [x] POST /api/chat/sessions - セッション作成 ✓
- [x] GET /api/chat/sessions/:sessionId - セッション取得 ✓
- [x] GET /api/chat/sessions/:sessionId/messages - メッセージ一覧取得 ✓
- [x] POST /api/chat/sessions/:sessionId/messages/stream - メッセージ送信（SSE）✓

### Notes
- [x] GET /api/notes - ノート一覧取得 ✓

### Images
- [x] POST /api/images/upload-url - アップロードURL取得 ✓

---

## フロントエンドE2E確認 (Playwright)

### 基本画面表示
- [x] / - ホーム画面表示 ✓
- [x] /login - ログイン画面表示 ✓（リンク確認）
- [x] /subjects - 科目一覧画面表示（8科目表示）✓
- [x] /notes - ノート一覧画面表示（空状態）✓

### 科目→カテゴリ→論点 遷移
- [x] /subjects/:subjectId - カテゴリ一覧表示 ✓
- [x] /subjects/:subjectId/:categoryId - 論点一覧表示 ✓
- [x] /subjects/:subjectId/:categoryId/:topicId - チャット画面表示 ✓

### チャット機能
- [x] メッセージ入力・送信 ✓
- [x] ユーザーメッセージ表示 ✓
- [x] AIレスポンス表示 ✓（SSEストリーミング修正済み）

### UIコンポーネント
- [x] Header表示確認 ✓
- [x] BottomNav表示確認 ✓
- [x] 画像アップロードボタン表示 ✓

---

## 残課題

1. ~~**チャットのAIレスポンス表示**~~ → 解決済み
   - Hono RPCクライアントがSSEを正しく処理しない問題 → fetch直接使用に変更
   - doneチャンクがメッセージ保存前に送信されていた → 保存後に送信するよう修正

2. **セッション永続化** - 現在はページ読み込みごとに新規セッションが作成される仕様。既存セッションの再利用は未実装。（Phase 4.2の範囲外）
