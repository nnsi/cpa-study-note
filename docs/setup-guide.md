# 本番環境セットアップ チェックリスト

## 1. Cloudflare Dashboard

- [x] **R2 バケット作成**
  - R2 > Create bucket
  - バケット名: `terraform-state`
  - Location: Asia Pacific

- [x] **R2 API Token 作成**
  - R2 > Manage R2 API Tokens > Create API token
  - Permissions: Object Read & Write
  - Specify bucket: `terraform-state`
  - メモ: Access Key ID → `R2_ACCESS_KEY_ID`
  - メモ: Secret Access Key → `R2_SECRET_ACCESS_KEY`

- [x] **Cloudflare API Token 作成**
  - Profile > API Tokens > Create Custom Token
  - Permissions:
    - Account / Workers Scripts / Edit
    - Account / D1 / Edit
    - Account / Workers R2 Storage / Edit
  - メモ: → `CLOUDFLARE_API_TOKEN`

- [x] **Account ID 確認**
  - Dashboard 右サイドバー
  - メモ: → `CLOUDFLARE_ACCOUNT_ID`

---

## 2. GitHub Repository Secrets 設定

Repository > Settings > Secrets and variables > Actions > Secrets

**Note:** 全環境で共通のシークレットのみここに設定。環境別のシークレットは後述の Environments で設定する。

- [x] `CLOUDFLARE_API_TOKEN` - Cloudflare API トークン
- [x] `CLOUDFLARE_ACCOUNT_ID` - アカウント ID
- [x] `R2_ACCESS_KEY_ID` - R2 アクセスキー
- [x] `R2_SECRET_ACCESS_KEY` - R2 シークレット
- [x] `GH_PAT` - GitHub Personal Access Token（Environment Variables 自動更新用）

### GH_PAT の作成手順

GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens

- [x] Token name: `cpa-study-infra`
- [x] Repository access: Only select repositories → このリポジトリを選択
- [x] Permissions:
  - **Repository permissions:**
    - Variables: Read and write
    - Environments: Read and write
- [x] Generate token → `GH_PAT` としてRepository Secretsに保存

---

## 3. Terraform 実行

- [ ] **Plan 実行**
  - Actions > Infrastructure > Run workflow
  - action: `plan`
  - 内容確認

- [ ] **Apply 実行**
  - Actions > Infrastructure > Run workflow
  - action: `apply`
  - GH_PAT が設定されていれば `D1_DATABASE_ID` が自動で Environment Variables に設定される
  - GH_PAT がない場合は Output を手動でコピー

---

## 4. GitHub Environments 設定

Repository > Settings > Environments

**Note:** `D1_DATABASE_ID` は Terraform Apply 時に自動設定される（GH_PAT が設定されている場合）

### staging

- [x] Environment 作成: `staging`

**Variables（手動設定）:**
- [x] `WEB_BASE_URL` = `https://cpa-study-web-stg.xxx.workers.dev`
- [x] `VITE_API_URL` = `https://cpa-study-api-stg.xxx.workers.dev`

**Variables（自動設定）:**
- `D1_DATABASE_ID` - Terraform Apply で自動設定
- `R2_BUCKET_NAME` - Terraform Apply で自動設定

**Secrets（環境別）:**
- [x] `JWT_SECRET` - 生成: `openssl rand -base64 32`
- [x] `GOOGLE_CLIENT_ID` - Google OAuth（stg用）
- [x] `GOOGLE_CLIENT_SECRET` - Google OAuth（stg用）
- [x] `OPENROUTER_API_KEY` - OpenRouter API キー（stg用）

### production

- [ ] Environment 作成: `production`
- [ ] Protection rules 設定（推奨）

**Variables（手動設定）:**
- [ ] `WEB_BASE_URL` = 本番フロントエンド URL
- [ ] `VITE_API_URL` = 本番 API URL

**Variables（自動設定）:**
- `D1_DATABASE_ID` - Terraform Apply で自動設定
- `R2_BUCKET_NAME` - Terraform Apply で自動設定

**Secrets（環境別）:**
- [ ] `JWT_SECRET` - 生成: `openssl rand -base64 32`（stgとは別の値）
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth（prod用）
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth（prod用）
- [ ] `OPENROUTER_API_KEY` - OpenRouter API キー（prod用）

---

## 5. 動作確認

- [ ] **staging デプロイ**
  - master ブランチに push
  - または Actions > Deploy > staging

- [ ] **staging 動作確認**
  - フロントエンド URL にアクセス
  - 基本機能の動作確認

---

## Google OAuth 設定

Google Cloud Console でstg/prod用に**2つのOAuthクライアント**を作成する。

### staging 用

- [ ] Google Cloud Console > APIs & Services > Credentials
- [ ] OAuth client ID 作成（Web application）
- [ ] 名前: `cpa-study-stg`
- [ ] Authorized JavaScript origins:
  - `https://cpa-study-web-stg.xxx.workers.dev`
- [ ] Authorized redirect URIs:
  - `https://cpa-study-api-stg.xxx.workers.dev/api/auth/google/callback`
- [ ] Client ID / Secret を **staging Environment Secrets** に設定

### production 用

- [ ] OAuth client ID 作成（Web application）
- [ ] 名前: `cpa-study-prod`
- [ ] Authorized JavaScript origins:
  - `https://cpa-study-web-prod.xxx.workers.dev`
- [ ] Authorized redirect URIs:
  - `https://cpa-study-api-prod.xxx.workers.dev/api/auth/google/callback`
- [ ] Client ID / Secret を **production Environment Secrets** に設定
