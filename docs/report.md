# API実装一貫性レビューレポート

**調査日**: 2026-02-05
**調査対象**: `apps/api/src/`
**調査方法**: Exploreエージェント + OpenAI Codex による並列レビュー

---

## 総合評価

| 観点 | 評価 | コメント |
|------|------|----------|
| アーキテクチャ | ✅ 優秀 | Route → UseCase → Repository を全feature で遵守 |
| エラーハンドリング | ⚠️ 良好 | Result型は統一的だが、型定義に欠損あり |
| 命名規則 | ✅ 優秀 | ファイル・関数・型すべて統一的 |
| DIパターン | ✅ 優秀 | Factory + Deps型で統一 |
| バリデーション | ✅ 優秀 | zValidatorで統一 |
| レスポンス形式 | ⚠️ 要改善 | Delete操作で不統一あり |

**一貫性スコア: 約90%** - 軽微な不一致のみで、全体的に堅牢な設計

---

## 発見事項（重要度順）

### 🔴 High: 型安全性の問題

#### 1. ErrorStatus に 413 が含まれていない

**箇所**:
- `apps/api/src/shared/lib/route-helpers.ts:14`
- `apps/api/src/shared/lib/errors.ts:59`

**問題**:
```typescript
// errors.ts で PAYLOAD_TOO_LARGE → 413 をマッピング
export const errorCodeToStatus: Record<ErrorCode, number> = {
  // ...
  PAYLOAD_TOO_LARGE: 413,  // ← 定義されている
}

// route-helpers.ts で ErrorStatus に 413 が含まれていない
type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 500  // ← 413 がない
```

**影響**: `payloadTooLarge()` を使用すると、宣言された型の範囲外のステータスコードが返され、型安全性が損なわれる

**修正案**:
```typescript
type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 500
```

---

### 🟡 Medium: レスポンス形式の不統一

#### 2. Delete操作のレスポンスが統一されていない

**箇所**:
| Feature | ファイル | 行 | レスポンス |
|---------|----------|-----|-----------|
| bookmark | `features/bookmark/route.ts` | 46 | 204 No Content |
| subject | `features/subject/route.ts` | 103 | `{ success: true }` (200) |
| study-domain | `features/study-domain/route.ts` | 78 | `{ success: true }` (200) |

**問題**: クライアントが削除操作の成功を判定する方法が統一されていない

**推奨**: 204 No Content に統一（REST標準に準拠）

---

#### 3. handleResult と handleResultWith の undefined 処理の違い

**箇所**:
- `apps/api/src/shared/lib/route-helpers.ts:56` (handleResult)
- `apps/api/src/shared/lib/route-helpers.ts:88` (handleResultWith)

**問題**:
- `handleResult`: `result.value === undefined` のとき自動的に 204 を返す
- `handleResultWith`: `successStatus === 204` のときのみ 204 を返す

usecaseが `ok(undefined)` を返し、routeが `handleResultWith` を使用すると、`transform(undefined)` が呼ばれて予期しない動作になる可能性がある

---

#### 4. View usecaseでの NOT_FOUND 誤用

**箇所**:
- `apps/api/src/features/view/usecase.ts:81`
- `apps/api/src/features/view/usecase.ts:104`

**問題**:
```typescript
// 現在の実装
if (!deps.categoryTopicsViewRepo) {
  return err(notFound("CategoryTopicsViewRepo not configured"))
}
```

Repository未設定はサーバー側の設定ミスであり、404（リソースが見つからない）ではなく 500（内部エラー）が適切

**修正案**:
```typescript
return err(internalError("CategoryTopicsViewRepo not configured"))
```

---

### 🟢 Low: コードスタイルの軽微な不統一

#### 5. study-domain CSV importのエラーハンドリング

**箇所**: `apps/api/src/features/study-domain/route.ts:101`

**問題**: 他のrouteは失敗を共通のエラーハンドラに委譲するが、ここだけローカルで `internalError` にラップしている

```typescript
// 現在
return handleResult(c, err(internalError("インポート中にエラーが発生しました")))

// 他との一貫性を考慮すると、usecaseでResult型を返してrouteは共通処理に委譲
```

---

#### 6. auth route.ts でのトークン生成ロジック

**箇所**: `apps/api/src/features/auth/route.ts:129-142`

**問題**: トークン生成ロジックがroute層に存在している。ビジネスロジックはusecase層に配置すべき

**推奨**: `usecase.ts` に `generateTokenPair()` を移動

---

## 統一されている点（良好な設計）

### アーキテクチャ

すべてのfeatureが以下の構造を遵守:
```
features/{feature}/
├── index.ts       # Feature factory
├── route.ts       # HTTPルーティング
├── usecase.ts     # ビジネスロジック
├── repository.ts  # データアクセス
└── domain.ts      # ドメインロジック（必要な場合）
```

### DIパターン

全featureで統一されたファクトリーパターン:
```typescript
export const create{Feature}Feature = (env: Env, db: Db) => {
  const repo = create{Feature}Repository(db)
  return {feature}Routes({ env, db })
}
```

### バリデーション

全routeで `@hono/zod-validator` を使用:
```typescript
.post("/", authMiddleware, zValidator("json", schema), async (c) => {
  const data = c.req.valid("json")
})
```

### 日付変換

全usecaseで統一的に ISO文字列に変換:
```typescript
createdAt: note.createdAt.toISOString()
```

---

## 推奨アクション

### 即時対応（ブロッカー）

| # | 内容 | ファイル |
|---|------|----------|
| 1 | ErrorStatus に 413 を追加 | `shared/lib/route-helpers.ts` |
| 2 | Delete操作を 204 に統一 | `subject/route.ts`, `study-domain/route.ts` |

### 短期対応（リファクタリング）

| # | 内容 | ファイル |
|---|------|----------|
| 3 | View usecase のエラーコードを INTERNAL_ERROR に変更 | `view/usecase.ts` |
| 4 | handleResultWith の undefined 処理を改善 | `shared/lib/route-helpers.ts` |
| 5 | auth トークン生成を usecase に移動 | `auth/route.ts`, `auth/usecase.ts` |

### 検討事項

- Delete操作のレスポンス形式を 204 に統一した場合、フロントエンドの対応が必要
- handleResult と handleResultWith の動作統一により、既存のroute実装に影響がないか確認

---

## 調査方法の詳細

### Exploreエージェント

- 全featureフォルダの構造を横断的に確認
- Route → UseCase → Repository のレイヤー遵守を検証
- 命名規則、DIパターン、バリデーション方法を比較

### OpenAI Codex (gpt-5.2-codex)

- 型安全性の問題を重点的に検出
- エラーハンドリングの一貫性を検証
- レスポンス形式の統一性を確認

両ツールで共通して指摘された「Delete操作の不統一」は優先度の高い改善点として特定
