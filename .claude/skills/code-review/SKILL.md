---
name: code-review
description: サブエージェント+Codexで並列コードレビュー→LGTMまで修正。使用場面: (1) 機能実装完了後、(2) 大規模変更後、(3) セキュリティ関連の変更後。トリガー: "レビューして", "LGTMまで修正", "/code-review"
---

# コードレビュー

実装完了後、複数の視点でコードレビューを行い、LGTMが出るまで修正する。

---

## 手順

### 1. 並列レビューの実行

サブエージェント（Explore）とCodex CLIを**同時に**起動する。

```
サブエージェントへの依頼例:
「以下の変更をレビューしてください。問題点があれば優先度（Critical/High/Medium/Low）をつけて報告してください。
- [変更したファイル一覧]
- [変更の概要]
LGTMの場合は明示的に「LGTM」と回答してください。」
```

```
Codex CLIへの依頼例（/codex使用）:
「以下のファイルをレビューしてください。軽微な指摘は不要、LGTMかブロッカーのみ回答してください。
- [ファイルパス]」
```

### 2. 指摘の整理

両方のレビュー結果を受け取ったら、指摘を優先度順に整理する。

| 優先度 | 意味 | 対応 |
|--------|------|------|
| Critical | セキュリティ問題、データ損失 | 即座に修正 |
| High | 機能不全、設計違反 | 修正必須 |
| Medium | パフォーマンス、ベストプラクティス | できれば修正 |
| Low | スタイル、軽微な改善 | 任意 |

**重要:** サブエージェントとCodexで異なる視点の指摘が出ることが多い。両方の指摘を確認する。

### 3. 修正の実施

Critical/Highの指摘を全て修正する。一箇所見つけたら「他にも同様の問題がないか」を確認する。

```
例: 「認可漏れ」がauth/route.tsで指摘された
→ 他のroute.ts（subject/route.ts, note/route.ts等）にも同様の問題がないか確認
```

### 4. 再レビュー

修正完了後、再度レビューを依頼する。

```
「指摘事項を修正しました。再レビューをお願いします。
- [修正内容の一覧]」
```

### 5. LGTM確認

**両方からLGTMが出るまで修正を続ける。**

片方だけLGTMでも、もう片方に指摘がある場合は修正する。

---

## よくある指摘パターン

### セキュリティ関連

| 指摘 | 対策 |
|------|------|
| 認可漏れ（IDOR） | usecase/repositoryでuserIdチェックを追加 |
| 入力サイズ制限なし | ZodスキーマにmaxLength/maxItemsを追加 |
| CSVサイズ制限なし | 1MB制限を追加 |

### アーキテクチャ関連

| 指摘 | 対策 |
|------|------|
| RouteからRepository直接呼び出し | UseCase経由に変更 |
| トランザクション未使用 | db.batch()またはNoTransactionRunnerを使用 |
| N+1クエリ | JOINまたはバルク取得に変更 |

### 型関連

| 指摘 | 対策 |
|------|------|
| 型アサーション使用 | Zodバリデーションまたは型設計を見直し |
| anyの使用 | 適切な型を定義 |

### 一貫性関連

| 指摘 | 対策 |
|------|------|
| `errorResponse` 使用 | `handleResult(c, result)` に変更 |
| `c.json({ error: ... })` 直接使用 | `handleResult(c, err(...))` に変更 |
| Deps型が `XxxUseCaseDeps` | `XxxDeps` に統一 |
| index.ts で env 省略 | `(_env: Env, db: Db)` に変更 |
| ローカルZodスキーマ定義 | `@cpa-study/shared/schemas` に移動 |
| POST で `{ message: "..." }` 返却 | 詳細データを返すように変更 |
| UseCase が Result を返さない | `Result<T, AppError>` を返すように変更 |
| DI がインライン | `const deps = { repo }` 形式に変更 |
| 野良Response型（ローカル定義） | `@cpa-study/shared/schemas` から import |
| `as Promise<T>` キャスト | Zod parseに変更（実行時検証必須） |

---

## API一貫性チェック（必須）

API関連の変更をレビューする際は、以下の一貫性を必ず確認する。

### route.ts
```bash
# errorResponse が残っていないか
grep -r "errorResponse" apps/api/src/features/**/route.ts

# c.json({ error: ... }) が残っていないか
grep -r "c.json.*error" apps/api/src/features/**/route.ts
```

**確認項目:**
- `handleResult(c, result)` または `handleResultWith(c, result, mapper)` を使用
- 直接エラー生成は `handleResult(c, err(xxxError("...")))` 形式
- DIは `const deps = { repo }` 形式
- POST/PUT は詳細データを返す（`{ message: "..." }` 禁止）

### usecase.ts
```bash
# Deps型が XxxDeps 形式か
grep -r "type.*Deps" apps/api/src/features/**/usecase.ts
```

**確認項目:**
- 全関数が `Result<T, AppError>` を返す
- Deps型は `XxxDeps` 形式（`BookmarkDeps`, `LearningDeps` 等）
- DBエラーは try-catch で捕捉し `err(internalError(...))` を返す

### index.ts
```bash
# シグネチャを確認
grep -r "export const create.*Feature" apps/api/src/features/**/index.ts
```

**確認項目:**
- `(_env: Env, db: Db)` 形式（env未使用でも `_env` として受け取る）
- routesには `{ db }` のみ渡す（env不要なら渡さない）

### スキーマ
```bash
# ローカルスキーマ定義がないか
grep -r "z.object" apps/api/src/features/**/route.ts
```

**確認項目:**
- Zodスキーマは `@cpa-study/shared/schemas` から import
- ローカル定義は禁止

### Response型（バックエンド）
```bash
# usecase内で野良Response型が定義されていないか
grep -rn "^type.*Response\s*=" apps/api/src/features/**/usecase.ts
grep -rn "^export type.*Response\s*=" apps/api/src/features/**/usecase.ts
```

**確認項目:**
- Response型は `@cpa-study/shared/schemas` から import
- ローカルResponse型定義は禁止（sharedとの型不整合を防ぐため）

### Response型（フロントエンド）
```bash
# as Promise<> キャストが残っていないか
grep -rn "as Promise<" apps/web/src/features/**/api.ts

# Zod parseを使用しているか
grep -rn "\.parse(json)" apps/web/src/features/**/api.ts
```

**確認項目:**
- `res.json() as Promise<T>` は禁止（実行時検証なし）
- 代わりに `xxxSchema.parse(json)` を使用（実行時検証あり）
- スキーマは `@cpa-study/shared/schemas` から import

---

## 出力

```
## コードレビュー結果

### サブエージェントの指摘
- [Critical/High/Medium/Low]: [内容] → [対応状況]

### Codexの指摘
- [Critical/High/Medium/Low]: [内容] → [対応状況]

### 修正内容
- [修正したファイル]: [変更内容]

### 最終結果
- サブエージェント: [LGTM/指摘あり]
- Codex: [LGTM/指摘あり]
```
