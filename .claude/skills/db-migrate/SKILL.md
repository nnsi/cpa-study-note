---
name: db-migrate
description: Drizzleマイグレーションを生成・適用する
---

# DBマイグレーション

## マイグレーション生成

スキーマ変更後に実行:

```bash
pnpm --filter @cpa-study/db drizzle-kit generate
```

## マイグレーション適用

### ローカル（開発）

```bash
pnpm --filter @cpa-study/db drizzle-kit migrate
```

### D1（本番/ステージング）

```bash
# ローカルD1
wrangler d1 migrations apply cpa-study-db --local

# リモートD1
wrangler d1 migrations apply cpa-study-db --remote
```

## Drizzle Studio（DB確認）

```bash
pnpm --filter @cpa-study/db drizzle-kit studio
```

## シードデータ投入

```bash
pnpm --filter @cpa-study/db seed
```
