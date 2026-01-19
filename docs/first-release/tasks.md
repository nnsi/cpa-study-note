# 実装タスクリスト

## Phase 1: 基盤

- [ ] **1-1**: モノレポセットアップ（pnpm workspace, package.json, tsconfig）
- [ ] **1-2**: packages/shared - Zodスキーマ・型定義の初期構築
- [ ] **1-3**: packages/db - Drizzleスキーマ定義（users, subjects, topics, chat等）
- [ ] **1-4**: packages/db - マイグレーション・シード設定（テストユーザー含む）
- [ ] **1-5**: apps/api - Hono基盤構築（shared/lib/result.ts等）
- [ ] **1-6**: apps/api - 認証機能（Google OAuth + JWT + 開発モード認証スキップ）
- [ ] **1-7**: apps/api - 科目・論点CRUD API（features/topic）

## Phase 2: コア機能

- [ ] **2-1**: apps/web - Vite + React + Tanstack Router基盤
- [ ] **2-2**: apps/web - レイアウト（Header, Sidebar, BottomNav）
- [ ] **2-3**: apps/web - ログイン画面（プロバイダー選択UI）
- [ ] **2-4**: apps/web - 論点マップUI（科目一覧・論点階層表示）
- [ ] **2-5**: apps/api - AI Adapter層（shared/lib/ai/ - Vercel AI SDK + モック実装）
- [ ] **2-6**: apps/api - AIチャット機能（features/chat - SSEストリーミング）
- [ ] **2-7**: apps/web - チャットUI（Logic/Hooks/Components 3層分離）
- [ ] **2-8**: apps/web - 論点詳細ページ（情報+チャット統合）

## Phase 3: 拡張機能

- [ ] **3-1**: apps/api - 画像アップロードAPI（R2連携）
- [ ] **3-2**: apps/api - OCR AI処理（Vision モデル連携）
- [ ] **3-3**: apps/web - 画像アップロードUI（カメラ/ギャラリー対応）
- [ ] **3-4**: apps/api - 質問評価AI（✔︎/△判定）
- [ ] **3-5**: apps/web - 質問評価バッジ表示
- [ ] **3-6**: apps/api - ノート機能（AI要約生成・保存）
- [ ] **3-7**: apps/web - ノートUI（要約表示・ユーザーメモ編集）
- [ ] **3-8**: apps/web - 学習進捗表示（理解済みチェック・統計）

## Phase 4: 仕上げ

- [ ] **4-1**: エラーハンドリング強化（Result型の一貫適用）
- [ ] **4-2**: パフォーマンス最適化（キャッシュ・遅延読み込み）
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
- [ ] `pnpm install` が成功する
- [ ] `pnpm -r typecheck` がエラーなし
- [ ] マイグレーションが適用できる
- [ ] Google OAuthでログインできる

### Phase 2 完了時
- [ ] 科目→大分類→論点の階層表示ができる
- [ ] 論点画面でメッセージ送信→ストリーミング回答が動作する

### Phase 3 完了時
- [ ] 画像アップロード→OCR→AI回答が動作する
- [ ] 質問送信後に✔︎/△バッジが表示される
- [ ] チャットからノート生成ができる

### Phase 4 完了時
- [ ] エラーハンドリングが統一されている
- [ ] パフォーマンスに問題がない
- [ ] AI出力品質がユーザー承認済み
- [ ] 各AIプロンプトが確定している

### Phase 5 完了時
- [ ] `terraform plan` が正常に実行できる
- [ ] `terraform apply` で本番環境が構築できる
- [ ] CI/CDパイプラインが正常に動作する
- [ ] 本番環境で全機能が動作する
