# セキュリティレビュー報告書

**実施日**: 2026-01-24
**レビュー方法**: Explore Agent + Codex CLI による並行レビュー

---

## エグゼクティブサマリー

本アプリケーションは基本的なセキュリティ実装（JWT認証、Zodバリデーション、Drizzle ORM）が整っているが、**本番化前に対応が必要な問題**が複数存在する。

| 重大度 | 件数 | 主な問題 |
|--------|------|----------|
| Critical | 4 | CORS全開放、開発モード認証バイパス、localStorage トークン保存 |
| High | 7 | 認可漏れ、レート制限なし、入力サイズ制限なし、JWT有効期限長すぎ |
| Medium | 6 | セッション管理なし、エラー情報漏洩、ファイル名サニタイズ欠如 |
| Low | 2 | 依存パッケージ監査、AIエラー処理 |

---

## Critical（即座に対応が必要）

### 1. CORS設定が全オリジン許可

**場所**: `apps/api/src/index.ts:15`

```typescript
.use("*", cors())  // 全オリジンを許可
```

**リスク**: CSRF脆弱性。Cookie認証移行時に被害が拡大。

**修正案**:
```typescript
.use("*", cors({
  origin: [env.WEB_BASE_URL],
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400
}))
```

---

### 2. 開発モード認証バイパスが本番で有効になる可能性

**場所**: `apps/api/src/shared/middleware/auth.ts:10-16`

```typescript
if (c.env.AUTH_MODE === "dev") {
  const devUser = getDevUser(c)
  c.set("user", devUser)
  return next()
}
```

**リスク**: 本番環境で誤って `AUTH_MODE=dev` が設定されると全認証が無視される。`X-Dev-User-Id` ヘッダーで任意のユーザーになりすまし可能。

**修正案**:
```typescript
// 本番環境では dev モードを強制拒否
if (c.env.AUTH_MODE === "dev") {
  if (c.env.ENVIRONMENT === "production") {
    throw new Error("Dev mode is not allowed in production")
  }
  // ...
}
```

または、本番ビルドで dev モード機能をコンパイル時に除外する。

---

### 3. JWT トークンを localStorage に保存

**場所**:
- `apps/web/src/lib/auth.ts:38`
- `apps/web/src/lib/api-client.ts:7`

**リスク**: XSS攻撃でトークンを即座に奪取可能。

**修正案**: HttpOnly Cookie ベースの認証に移行。
- サーバー側は既に `auth_token` Cookie を設定済み（`apps/api/src/features/auth/route.ts:98`）
- クライアント側で localStorage を削除し、Cookie認証に統一
- CSRF対策として `SameSite=Strict` + CSRFトークンを導入

---

### 4. JWT SECRET の強度検証なし

**場所**: `apps/api/src/features/auth/route.ts:86, 115`

**リスク**: 短い・単純なシークレットでブルートフォース攻撃に脆弱。

**修正案**:
- 環境変数バリデーションで最小32バイト以上を要求
- 起動時にシークレット長をチェック

---

## High（早期対応が必要）

### 5. 認可漏れ：他ユーザーのメッセージ評価が可能

**場所**:
- `apps/api/src/features/chat/route.ts:132`
- `apps/api/src/features/chat/usecase.ts:140`

**リスク**: `/messages/:messageId/evaluate` がメッセージ所有者チェックなしで評価・更新を許可。任意のログインユーザーが他人のメッセージを操作可能。

**修正案**: messageId から session → user を辿る認可チェックを追加。

```typescript
// usecase.ts
const message = await chatRepo.findMessageWithSession(messageId)
if (!message || message.session.userId !== userId) {
  return err("NOT_FOUND")
}
```

---

### 6. レート制限未実装

**場所**: 全エンドポイント（特に AI 系）

**リスク**: ブルートフォース攻撃、リソース枯渇攻撃、AI API コスト直撃。

**対象エンドポイント**:
- `POST /api/chat/sessions/:sessionId/messages`（ストリーム）
- `POST /api/images/:imageId/ocr`（OCR）
- `POST /api/notes`（ノート生成）
- `/api/auth/*`（認証）

**修正案**: hono/rate-limit ミドルウェア導入
```typescript
import { rateLimiter } from "hono-rate-limiter"

app.use("/api/auth/*", rateLimiter({
  windowMs: 60 * 1000,
  limit: 5
}))
app.use("/api/chat/*/messages", rateLimiter({
  windowMs: 60 * 1000,
  limit: 20
}))
```

---

### 7. 入力サイズ・ファイルサイズ制限なし

**場所**:
- `apps/api/src/features/chat/route.ts:96`（content/ocrResult）
- `apps/api/src/features/image/route.ts:26`（filename/mimeType/本体）
- `apps/api/src/features/note/route.ts:85`（配列・メモ）

**リスク**: 巨大入力で DoS、コスト過多、メモリ膨張。

**修正案**: Zod スキーマに最大値制限を追加
```typescript
content: z.string().min(1).max(10000),
userMemo: z.string().max(5000),
ocrResult: z.string().max(50000),
keyPoints: z.array(z.string().max(500)).max(20)
```

---

### 8. MIME Type バリデーション不足

**場所**: `apps/api/src/features/image/route.ts:30-34`

```typescript
z.object({
  filename: z.string(),
  mimeType: z.string()  // 任意の文字列OK
})
```

**リスク**: 攻撃者が任意の mimeType を送信可能。

**修正案**:
```typescript
mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"])
```

---

### 9. ファイル名サニタイゼーション欠落

**場所**: `apps/api/src/features/image/usecase.ts:51-52`

```typescript
const r2Key = `images/${userId}/${imageId}/${filename}`
```

**リスク**: ファイル名に `../` が含まれる場合、パストラバーサル可能性。

**修正案**:
```typescript
const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '')
const r2Key = `images/${userId}/${imageId}/${sanitizedFilename}`
```

---

### 10. JWT 有効期限が長すぎる（7日）

**場所**: `apps/api/src/features/auth/route.ts:95, 124`

**リスク**: トークン漏洩時の影響が長期化。

**修正案**:
- アクセストークン有効期限を 1時間 に短縮
- Refresh Token を別途発行（HttpOnly Cookie、長有効期限）
- セッションテーブルで即座無効化をサポート

---

### 11. X-Dev-User-Id ヘッダーで本番ユーザーなりすまし可能

**場所**: `apps/api/src/shared/middleware/auth.ts:42-44`

```typescript
const userId = c.req.header("X-Dev-User-Id") ?? c.env.DEV_USER_ID ?? "test-user-1"
```

**リスク**: 開発モードが有効な環境でクライアントから任意のユーザーになりすまし可能。

**修正案**: 本番環境では `getDevUser` 関数そのものを削除、または dev ヘッダーを無視。

---

## Medium（計画的に対応）

### 12. セッションテーブルなし

**リスク**: 複数デバイスでのセッション管理不可、logout の即座無効化ができない。

**修正案**: セッションテーブルを実装し、logout 時にサーバー側で追跡。

---

### 13. OCR テキストが平文保存

**場所**: `packages/db/src/schema/images.ts:13`

**リスク**: 機密文書の OCR 結果が DB 内に平文で保存。

**修正案**: 機密度に応じて暗号化を検討。

---

### 14. エラーレスポンスに技術情報漏洩

**場所**: `apps/api/src/features/auth/providers/google.ts:39, 51`

```typescript
throw new Error(`Token exchange failed: ${res.status}`)
```

**リスク**: HTTPステータスコード、エラーメッセージが詳細すぎる。

**修正案**: エラーを抽象化、本番環境ではログのみに記録。
```typescript
console.error(`Token exchange failed: ${res.status}`)
throw new Error("Authentication failed")
```

---

### 15. R2 キーにユーザーID を含む

**場所**: `apps/api/src/features/image/usecase.ts:51-52`

**リスク**: ユーザーIDがR2キーに含まれており推測可能（影響は限定的、各エンドポイントで所有権確認済み）。

**修正案**: ユーザーIDをハッシュ化、または除外。

---

### 16. Refresh Token 実装が不完全

**場所**: `apps/api/src/features/auth/route.ts:112-136`

**リスク**: 現在のJWTトークンをリフレッシュしているだけで、refresh token 自体が存在しない。

**修正案**: 長有効期限の refresh token を別途発行（Secure Cookie, HttpOnly）。

---

### 17. Google OAuth エンドポイントの検証不足

**場所**: `apps/api/src/features/auth/providers/google.ts:26-42`

**リスク**: `/oauth2/v2/userinfo` エンドポイントを呼び出すが、OpenID Connect の ID Token (JWT) で検証すべき。

**修正案**: OpenID Connect の ID Token で検証（より安全で改ざん検出可能）。

---

## Low（軽微）

### 18. 依存パッケージの定期スキャン未設定

**リスク**: 既知の脆弱性を持つパッケージが混入する可能性。

**修正案**: CI/CD に `pnpm audit` を組み込み。

---

### 19. AI エラー処理が広すぎる

**場所**: `apps/api/src/features/chat/usecase.ts:114-121`

```typescript
try {
  const parsed = JSON.parse(result.content)
} catch {
  aiSummary = result.content  // フォールバック処理
}
```

**リスク**: パース失敗時にフォールバックするため、AIレスポンスが不完全でも続行。

**修正案**: 明示的なバリデーション。

---

## 対応が確認された項目（問題なし）

| 項目 | 状態 |
|------|------|
| SQLインジェクション対策 | Drizzle ORM により全クエリがパラメータ化 |
| Cookie セキュリティ属性 | `httpOnly: true`, `secure: true`, `sameSite: "Lax"` 設定済み |
| State検証（CSRF対策） | OAuth フローで `crypto.randomUUID()` でstate生成・検証実装済み |
| 所有権確認（大部分） | chat/note/image でユーザーIDベースの所有権確認を実装済み |
| 依存パッケージ | hono, jose, zod, drizzle-orm 全て最新系統 |

---

## 推奨対応スケジュール

### Phase 1（即座、1-2日）
1. [ ] CORS設定を制限
2. [ ] 本番環境の AUTH_MODE を明示的に設定（dev 禁止）
3. [ ] localStorage から JWT を削除（Cookie のみに）
4. [ ] MIME Type バリデーション厳密化

### Phase 2（1週間以内）
5. [ ] レート制限ミドルウェア導入
6. [ ] 認可漏れ修正（メッセージ評価）
7. [ ] JWT 有効期限を短縮（1時間程度）
8. [ ] ファイル名サニタイゼーション実装
9. [ ] Zod スキーマに最大値制限追加

### Phase 3（2-4週間）
10. [ ] セッションテーブル実装、logout の即座無効化
11. [ ] Refresh Token 適切に分離
12. [ ] OAuth エンドポイントを OpenID Connect に変更
13. [ ] エラーハンドリングの改善

### Phase 4（ロードマップ）
14. [ ] 機密情報の暗号化（OCRテキスト等）
15. [ ] デバイス・セッション管理の強化
16. [ ] セキュリティ監査ログ実装

---

## 確認事項（Open Questions）

1. **AUTH_MODE の強制検証**: 本番環境でデプロイ時のガードはありますか？
2. **認証方式の方針**: 今後は「localStorage + Bearer」継続ですか、Cookie 移行予定ですか？
3. **許可 Origin**: CORS で許可すべき正規のフロントエンド Origin はどれですか？

---

## レビュー実施者

- **Explore Agent**: 包括的なコード調査
- **Codex CLI**: 認証・入力検証・API セキュリティ・データ保護の観点でレビュー

---

*本レポートは自動生成されたものであり、本番化前に人間によるレビューを推奨します。*
