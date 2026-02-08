# 実装タスクリスト

## Phase 1: 基盤

- [x] **1-1**: モノレポセットアップ（pnpm workspace, package.json, tsconfig）
- [x] **1-2**: packages/shared - Zodスキーマ・型定義の初期構築
- [x] **1-3**: packages/db - Drizzleスキーマ定義（users, subjects, topics, chat等）
- [x] **1-4**: packages/db - マイグレーション・シード設定（テストユーザー含む）
- [x] **1-5**: apps/api - Hono基盤構築（shared/lib/result.ts等）
- [x] **1-6**: apps/api - 認証機能（Google OAuth + JWT + 開発モード認証スキップ）
- [x] **1-7**: apps/api - 科目・論点CRUD API（features/topic）

## Phase 2: コア機能

- [x] **2-1**: apps/web - Vite + React + Tanstack Router基盤
- [x] **2-2**: apps/web - レイアウト（Header, Sidebar, BottomNav）
- [x] **2-3**: apps/web - ログイン画面（プロバイダー選択UI）
- [x] **2-4**: apps/web - 論点マップUI（科目一覧・論点階層表示）
- [x] **2-5**: apps/api - AI Adapter層（shared/lib/ai/ - Vercel AI SDK + モック実装）
- [x] **2-6**: apps/api - AIチャット機能（features/chat - SSEストリーミング）
- [x] **2-7**: apps/web - チャットUI（Logic/Hooks/Components 3層分離）
- [x] **2-8**: apps/web - 論点詳細ページ（情報+チャット統合）

## Phase 3: 拡張機能

- [x] **3-1**: apps/api - 画像アップロードAPI（R2連携）
- [x] **3-2**: apps/api - OCR AI処理（Vision モデル連携）
- [x] **3-3**: apps/web - 画像アップロードUI（カメラ/ギャラリー対応）
- [x] **3-4**: apps/api - 質問評価AI（✔︎/△判定）
- [x] **3-5**: apps/web - 質問評価バッジ表示
- [x] **3-6**: apps/api - ノート機能（AI要約生成・保存）
- [x] **3-7**: apps/web - ノートUI（論点別ノート一覧・ノート作成ボタン）
- [x] **3-8**: apps/web - 学習進捗表示（理解済みチェック・統計）

## Phase 4: 仕上げ

- [x] **4-1**: エラーハンドリング強化（Result型の一貫適用）
- [x] **4-2**: パフォーマンス最適化（キャッシュ・遅延読み込み）
- [ ] **4-3**: AI本番切り替え・プロンプト調整 ⚠️ **ユーザー協業必須**
  - モック → Vercel AI SDK（本番）への切り替え
  - 回答AIのシステムプロンプト調整
  - OCR AIのプロンプト調整
  - 質問評価AIの判定基準調整
  - 要約AIのプロンプト調整
  - ユーザーによる出力品質レビュー・フィードバック

## Phase 5: インフラ・デプロイ（Terraform IaC）

- [ ] **5-1**: Terraform基盤セットアップ（provider, backend設定）
- [ ] **5-2**: Cloudflare Workers/Pages リソース定義
- [ ] **5-3**: Cloudflare D1 データベースリソース定義
- [ ] **5-4**: Cloudflare R2 バケットリソース定義
- [ ] **5-5**: 環境変数・シークレット管理（wrangler.toml + Terraform variables）
- [ ] **5-6**: CI/CD パイプライン設定（GitHub Actions）
- [ ] **5-7**: 本番環境デプロイ・動作確認

---

## 開発時の自己検証ルール

**各タスク実装後は必ず以下を確認すること:**

### APIエンドポイント実装後
```bash
# 開発モードで認証スキップ
AUTH_MODE=dev

# curlで想定値が取得できるか確認
curl http://localhost:8787/api/{endpoint} | jq

# エラーケースも確認
curl http://localhost:8787/api/{endpoint}/invalid-id
```

### フロントエンド実装後
```
# Playwright MCPでブラウザ動作確認
1. mcp__playwright__browser_navigate でページを開く
2. mcp__playwright__browser_snapshot で状態確認
3. mcp__playwright__browser_click / type で操作
4. mcp__playwright__browser_wait_for で結果確認
```

---

## 検証チェックリスト

各フェーズ完了時に確認:

### Phase 1 完了時
- [x] `pnpm install` が成功する
- [x] `pnpm -r typecheck` がエラーなし
- [x] マイグレーションが適用できる
- [ ] Google OAuthでログインできる ← 本番環境で要確認

### Phase 2 完了時
- [x] 科目→大分類→論点の階層表示ができる
- [x] 論点画面でメッセージ送信→ストリーミング回答が動作する

### Phase 3 完了時
- [x] 画像アップロード→OCR→AI回答が動作する（モックで確認）
- [x] 質問送信後に✔︎/△バッジが表示される ✓
- [x] チャットからノート生成ができる ✓

### Phase 4 完了時
- [x] エラーハンドリングが統一されている
- [x] パフォーマンスに問題がない
- [ ] AI出力品質がユーザー承認済み
- [ ] 各AIプロンプトが確定している

### Phase 5 完了時
- [ ] `terraform plan` が正常に実行できる
- [ ] `terraform apply` で本番環境が構築できる
- [ ] CI/CDパイプラインが正常に動作する
- [ ] 本番環境で全機能が動作する
