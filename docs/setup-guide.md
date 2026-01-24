# 本番環境セットアップ チェックリスト

## 1. Cloudflare Dashboard

- [ ] **R2 バケット作成**
  - R2 > Create bucket
  - バケット名: `terraform-state`
  - Location: Asia Pacific

- [ ] **R2 API Token 作成**
  - R2 > Manage R2 API Tokens > Create API token
  - Permissions: Object Read & Write
  - Specify bucket: `terraform-state`
  - メモ: Access Key ID → `R2_ACCESS_KEY_ID`
  - メモ: Secret Access Key → `R2_SECRET_ACCESS_KEY`

- [ ] **Cloudflare API Token 作成**
  - Profile > API Tokens > Create Custom Token
  - Permissions:
    - Account / Workers Scripts / Edit
    - Account / D1 / Edit
    - Account / Workers R2 Storage / Edit
  - メモ: → `CLOUDFLARE_API_TOKEN`

- [ ] **Account ID 確認**
  - Dashboard 右サイドバー
  - メモ: → `CLOUDFLARE_ACCOUNT_ID`

---

## 2. GitHub Secrets 設定

Repository > Settings > Secrets and variables > Actions > Secrets

- [ ] `CLOUDFLARE_API_TOKEN` - Cloudflare API トークン
- [ ] `CLOUDFLARE_ACCOUNT_ID` - アカウント ID
- [ ] `R2_ACCESS_KEY_ID` - R2 アクセスキー
- [ ] `R2_SECRET_ACCESS_KEY` - R2 シークレット
- [ ] `JWT_SECRET` - 生成: `openssl rand -base64 32`
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth
- [ ] `OPENROUTER_API_KEY` - OpenRouter API キー

---

## 3. Terraform 実行

- [ ] **Plan 実行**
  - Actions > Infrastructure > Run workflow
  - action: `plan`
  - 内容確認

- [ ] **Apply 実行**
  - Actions > Infrastructure > Run workflow
  - action: `apply`
  - Output をメモ:
    - staging D1_DATABASE_ID: `________________`
    - production D1_DATABASE_ID: `________________`

---

## 4. GitHub Environments 設定

Repository > Settings > Environments

### staging

- [ ] Environment 作成: `staging`
- [ ] Variable: `D1_DATABASE_ID` = Terraform output の値
- [ ] Variable: `WEB_BASE_URL` = `https://cpa-study-web-stg.xxx.workers.dev`
- [ ] Variable: `VITE_API_URL` = `https://cpa-study-api-stg.xxx.workers.dev`

### production

- [ ] Environment 作成: `production`
- [ ] Variable: `D1_DATABASE_ID` = Terraform output の値
- [ ] Variable: `WEB_BASE_URL` = 本番フロントエンド URL
- [ ] Variable: `VITE_API_URL` = 本番 API URL
- [ ] Protection rules 設定（推奨）

---

## 5. ローカル開発環境

- [ ] **`.dev.vars` 作成**
  ```bash
  cd apps/api
  cp .dev.vars.example .dev.vars
  # 必要に応じて OPENROUTER_API_KEY 等を設定
  ```

- [ ] **依存関係インストール**
  ```bash
  pnpm install
  ```

---

## 6. 動作確認

- [ ] **ローカル開発**
  ```bash
  pnpm dev
  ```
  - API: http://127.0.0.1:8787
  - Web: http://localhost:5174

- [ ] **staging デプロイ**
  - master ブランチに push
  - または Actions > Deploy > staging

- [ ] **staging 動作確認**
  - フロントエンド URL にアクセス
  - 基本機能の動作確認

---

## Google OAuth（任意）

- [ ] Google Cloud Console でプロジェクト作成
- [ ] OAuth client ID 作成（Web application）
- [ ] Authorized redirect URIs 追加:
  - `https://cpa-study-api-stg.xxx.workers.dev/auth/google/callback`
  - `https://cpa-study-api-prod.xxx.workers.dev/auth/google/callback`
- [ ] Client ID / Secret を GitHub Secrets に設定済み
