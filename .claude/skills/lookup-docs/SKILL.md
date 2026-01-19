---
name: lookup-docs
description: Context7を使って技術ドキュメントを参照する
---

# ドキュメント参照

Context7 MCPを使用して最新のドキュメントを取得する。

## 使用方法

1. `mcp__plugin_context7_context7__resolve-library-id` でライブラリIDを取得
2. `mcp__plugin_context7_context7__query-docs` でドキュメントを検索

## 主要ライブラリ

| 技術 | 検索キーワード |
|-----|---------------|
| Hono | hono |
| Drizzle ORM | drizzle-orm |
| Tanstack Router | tanstack-router |
| Tanstack Query | tanstack-query |
| Cloudflare Workers | cloudflare workers |
| Cloudflare D1 | cloudflare d1 |
| Cloudflare R2 | cloudflare r2 |
| Zod | zod |
| Tailwind CSS | tailwindcss |

## 使用例

```
# Honoのミドルウェアについて調べる
resolve-library-id: libraryName="hono", query="middleware authentication"
query-docs: libraryId="/honojs/hono", query="how to create authentication middleware"

# DrizzleでD1を使う方法
resolve-library-id: libraryName="drizzle-orm", query="cloudflare d1 setup"
query-docs: libraryId="/drizzle-team/drizzle-orm", query="cloudflare d1 configuration"
```

## 注意

- 1つの質問につき最大3回までの呼び出しに制限
- 見つからない場合は公式ドキュメントURLを直接WebFetchで参照
