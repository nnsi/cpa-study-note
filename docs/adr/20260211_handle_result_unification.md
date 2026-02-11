# ADR: handleResult統合とRoute層の`if (!result.ok)`撲滅

**日付**: 2026-02-11
**ステータス**: 承認済み

## コンテキスト

Route層のエラーハンドリングに `handleResult` と `handleResultWith` の2つのヘルパー関数が存在し、加えて `if (!result.ok)` による手動分岐が16箇所に散在していた。パターンが複数あることで、新規Feature作成時にどれを使うべきか迷う状態だった。

### 変更前の状態

```typescript
// パターン1: handleResult（エラー分岐のみ）
if (!result.ok) return handleResult(c, result)
return c.json({ subject: result.value }, 200)

// パターン2: handleResultWith（transform付き）
return handleResultWith(c, result, (data) => ({ subject: data }))

// パターン3: 手動分岐でステータス動的切替
if (!result.ok) return handleResult(c, result)
return c.json({ bookmark: result.value.bookmark }, result.value.alreadyExists ? 200 : 201)

// パターン4: deleteで { success: true } を返す
if (!result.ok) return handleResult(c, result)
return c.json({ success: true }, 200)
```

## 決定

### 1. `handleResult` にオーバーロードで統合、`handleResultWith` を廃止

```typescript
// そのまま返す
return handleResult(c, result)

// キーでラップ: { subject: value }
return handleResult(c, result, "subject")

// ステータス指定
return handleResult(c, result, 204)

// キー + ステータス
return handleResult(c, result, "subject", 201)

// void結果 → 自動的に 204 No Content
return handleResult(c, result)  // result.value === undefined → 204
```

第3引数の型で振り分け: `string` ならキー、`number` ならステータス。

### 2. `handleResultImage` を新設（バイナリレスポンス用）

```typescript
return handleResultImage(c, result, "private, max-age=3600")
```

画像配信エンドポイント用。今後バイナリレスポンスが増えた場合にも統一的に扱える。

### 3. マルチステップ処理をUseCase層に移動

Route層で2つのUseCaseをチェインしていた3箇所をUseCase内部に統合:

- `createSubject`: insert後にgetで完全なSubjectを返す
- `updateSubjectTree`: update後にgetで最新ツリーを返す
- `evaluateQuestion`: メッセージ取得 → AI評価を内部で一括実行

### 4. Bookmark addを冪等操作として200固定

`alreadyExists` による200/201動的ステータスを廃止。ブックマーク追加は冪等操作なので常に200を返す。

### 5. Delete操作は204 No Content

`{ success: true }` レスポンスを廃止し、204 No Content（ボディなし）に統一。フロントエンドのAPI関数も `Promise<void>` に変更。

## 影響範囲

| 対象 | 変更内容 |
|------|---------|
| `route-helpers.ts` | `handleResult` オーバーロード統合、`handleResultWith` 削除、`handleResultImage` 追加 |
| Route 10件（auth以外全て） | `if (!result.ok)` 排除、`handleResult(c, result, "key")` に統一 |
| UseCase 3件 | マルチステップ処理を内部化（subject, tree, chat） |
| UseCase 1件 | bookmark addの返却型を簡素化 |
| Frontend API 3件 | delete関数を `Promise<void>` に変更 |
| Frontend テスト 2件 | deleteのモック値を `undefined` に変更 |
| SKILLファイル 3件 | `handleResultWith` の記述を新APIに更新 |

## 結果

- Route層の `if (!result.ok)`: 16箇所 → 0箇所（auth除く）
- `handleResultWith`: 全ソースから完全削除
- Route層は全て `return handleResult(c, result, ...)` の1行で完結
- auth/route.tsのみ例外（token操作等の副作用があるため手動ハンドリング維持）
