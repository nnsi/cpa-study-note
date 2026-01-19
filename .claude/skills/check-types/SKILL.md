---
name: check-types
description: TypeScript型チェックとESLintを実行して問題を修正する
---

# 型チェック・リント実行

コード変更後に型エラーやリント違反を検出・修正する。

## 実行コマンド

```bash
# 全パッケージの型チェック
pnpm -r typecheck

# 特定パッケージの型チェック
pnpm --filter @cpa-study/api typecheck
pnpm --filter @cpa-study/web typecheck
pnpm --filter @cpa-study/shared typecheck
pnpm --filter @cpa-study/db typecheck

# ESLint
pnpm -r lint

# ESLint自動修正
pnpm -r lint --fix
```

## エラー対応フロー

1. 型チェック実行
2. エラーがあれば該当ファイルを読む
3. エラー内容を分析して修正
4. 再度型チェックで確認
