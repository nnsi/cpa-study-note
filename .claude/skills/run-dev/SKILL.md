---
name: run-dev
description: 開発サーバーを起動する
---

# 開発サーバー起動

## コマンド

```bash
# 全体（API + Web 同時起動）
pnpm dev

# APIのみ（Cloudflare Workers）
pnpm --filter @cpa-study/api dev

# Webのみ（Vite）
pnpm --filter @cpa-study/web dev
```

## 確認ポイント

- API: `http://localhost:8787`
- Web: `http://localhost:5173`
- D1ローカル: `.wrangler/state/v3/d1/`
