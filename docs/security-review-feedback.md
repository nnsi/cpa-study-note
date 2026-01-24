# セキュリティレビューフィードバック報告書

**実施日**: 2026-01-24
**レビュー方法**: Explore Agent + Codex CLI + ペネトレーションテスト（並行実施）

---

## エグゼクティブサマリー

| レビュー手法 | 結果 |
|-------------|------|
| **Explore Agent** | 12項目中10項目実装済み（83%） |
| **Codex CLI** | 高優先度1件、中優先度4件、低優先度3件 |
| **ペネトレーションテスト** | 高リスク1件、中リスク2件、低リスク1件 |

**総合評価**: セキュリティ修正は概ね適切に実装されている。認可チェック、CORS、JWT検証、パストラバーサル防御などは堅牢。残存する問題は限定的。

---

## 残存する問題（優先度順）

### 高優先度（即時対応推奨）

| # | 問題 | ファイル | 詳細 |
|---|------|----------|------|
| 1 | **画像アップロードのサイズ制限なし** | `apps/api/src/features/image/route.ts:50` | DoS攻撃リスク。10MB制限を追加すべき |
| 2 | **MIME Type バリデーション未適用** | `apps/api/src/features/image/route.ts:30-35` | `z.string()` → `z.enum(allowedMimeTypes)` に変更 |
| 3 | **JWT SECRET検証が警告のみ** | `apps/api/src/features/auth/route.ts:53-57` | 本番環境では `throw new Error()` で起動ブロック |

### 中優先度（次リリース前）

| # | 問題 | ファイル | 詳細 |
|---|------|----------|------|
| 4 | **セキュリティヘッダー不足** | `apps/api/src/index.ts` | X-Content-Type-Options, X-Frame-Options, CSP等が未設定 |
| 5 | **マジックバイト検証なし** | `apps/api/src/features/image/usecase.ts` | ファイル先頭バイトで実際の形式を検証すべき |
| 6 | **起動時環境変数バリデーション不足** | `apps/api/src/index.ts` | 必須変数の存在チェックを追加 |

### 低優先度（技術的負債）

| # | 問題 | 詳細 |
|---|------|------|
| 7 | Stored XSS（潜在的） | HTMLタグが保存可能。Reactでエスケープされるが将来的なリスク |
| 8 | AI APIエラー露出 | `String(error)` を汎用メッセージに置換 |

---

## 適切に実装されている項目

| 項目 | 検証結果 |
|------|----------|
| **CORS設定** | オリジン制限が正しく動作、悪意あるオリジンからは拒否 |
| **認証バイパス防止** | 本番環境では `ENVIRONMENT !== "local"` でdev modeブロック |
| **JWT Cookie認証移行** | localStorage不使用、HttpOnly Cookie使用 |
| **認可チェック** | 全usecaseでuserIdを検証、他ユーザーのリソースにアクセス不可 |
| **入力サイズ制限** | content (10000), ocrResult (50000), userMemo (50000) 等 |
| **ファイル名サニタイゼーション** | パストラバーサル防止が完全に機能 |
| **JWT有効期限** | 15分（短縮済み） |
| **Refresh Token** | HttpOnly Cookie + SHA-256ハッシュ保存 |
| **エラー情報漏洩防止** | 抽象的なエラーメッセージを返却 |
| **SQLインジェクション防御** | Drizzle ORMによるパラメータ化 |
| **CSRF防御** | OAuth state検証が正しく機能 |

---

## ペネトレーションテスト攻撃結果

| 攻撃カテゴリ | 試行 | 結果 |
|-------------|------|------|
| **認証バイパス** | 無効なJWT、偽造OAuth | ブロック |
| **認可回避** | 他ユーザーのノート/セッション/画像 | ブロック |
| **XSS** | `<script>alert(1)</script>` | 保存されるがエスケープ |
| **SQLi** | `' OR 1=1 --` | ORMが保護 |
| **パストラバーサル** | `../../../etc/passwd` | サニタイズ |
| **CORS** | evil.comオリジン | 拒否 |
| **開発モード偽装** | X-Dev-User-Id | ローカルのみ成功（想定内） |

---

## 推奨対応

### 1. 画像アップロードサイズ制限

**ファイル**: `apps/api/src/features/image/route.ts`

```typescript
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
if (body.byteLength > MAX_SIZE) {
  return c.json({ error: "File too large" }, 413)
}
```

### 2. MIME Type バリデーション

**ファイル**: `apps/api/src/features/image/route.ts`

```typescript
import { allowedMimeTypes } from "@cpa-study/shared/schemas/image"

zValidator("json", z.object({
  filename: z.string().max(255),
  mimeType: z.enum(allowedMimeTypes),
}))
```

### 3. JWT SECRET検証強化

**ファイル**: `apps/api/src/features/auth/route.ts`

```typescript
if (env.ENVIRONMENT !== "local" && env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production")
}
```

### 4. セキュリティヘッダー追加

**ファイル**: `apps/api/src/index.ts`

```typescript
import { secureHeaders } from "hono/secure-headers"

app.use("*", secureHeaders())
```

### 5. マジックバイト検証

**ファイル**: `apps/api/src/features/image/usecase.ts`

```typescript
const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47],
  "image/gif": [0x47, 0x49, 0x46],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
}

const validateMagicBytes = (buffer: ArrayBuffer, mimeType: string): boolean => {
  const bytes = new Uint8Array(buffer)
  const expected = MAGIC_BYTES[mimeType]
  if (!expected) return false
  return expected.every((b, i) => bytes[i] === b)
}
```

### 6. 環境変数バリデーション

**ファイル**: `apps/api/src/index.ts`

```typescript
const validateEnv = (env: Env) => {
  const required = ["JWT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "API_BASE_URL", "WEB_BASE_URL"]
  for (const key of required) {
    if (!env[key as keyof Env]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }
}
```

---

## スコープ外項目（意図的に未対応）

| 項目 | 理由 |
|------|------|
| レート制限 | 別途対応予定 |
| OCRテキスト暗号化 | 別途対応予定 |

---

## 結論

セキュリティレポートの修正項目は**概ね適切に実装されている**。残る問題は画像アップロード周りとセキュリティヘッダーに集中しており、対応は限定的。上記6件の対応で本番化前のセキュリティ要件を満たす。

---

## レビュー実施者

- **Explore Agent**: 実装状況の詳細確認
- **Codex CLI**: 認証・入力検証・API セキュリティ・データ保護の観点でレビュー
- **ペネトレーションテスト Agent**: 実際の攻撃シナリオによる検証

---

*本レポートは自動生成されたものであり、本番化前に人間によるレビューを推奨します。*
