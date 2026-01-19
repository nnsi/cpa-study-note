---
name: deploy-check
description: デプロイ前のチェックリストを実行する
---

# デプロイ前チェック

本番デプロイ前に実行すべきチェック項目。

## チェックリスト

### 1. 型チェック
```bash
pnpm -r typecheck
```

### 2. リント
```bash
pnpm -r lint
```

### 3. テスト
```bash
pnpm -r test
```

### 4. ビルド確認
```bash
# API
pnpm --filter @cpa-study/api build

# Web
pnpm --filter @cpa-study/web build
```

### 5. マイグレーション確認
```bash
# 未適用のマイグレーションがないか確認
wrangler d1 migrations list cpa-study-db --remote
```

### 6. 環境変数確認

必要な環境変数:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENROUTER_API_KEY`
- `JWT_SECRET`
- `API_BASE_URL`
- `WEB_BASE_URL`

## デプロイ実行

```bash
# API（Cloudflare Workers）
pnpm --filter @cpa-study/api deploy

# Web（Cloudflare Pages）
pnpm --filter @cpa-study/web deploy
```
