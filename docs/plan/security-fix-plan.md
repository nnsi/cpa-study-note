# セキュリティレビュー修正計画

## 対象項目

### 対応済み
| # | 重大度 | 項目 | 修正箇所 | 状態 |
|---|--------|------|----------|------|
| H1 | High | 認可漏れ（メッセージ評価） | chat/route.ts, chat/usecase.ts | ✅ |
| H3 | High | 入力サイズ制限なし | schemas/image.ts, route.ts | ✅ |
| H4 | High | MIME Type バリデーション | schemas/image.ts | ✅ |
| H5 | High | ファイル名サニタイゼーション | image/usecase.ts | ✅ |
| M1 | Medium | セッション管理 | refreshTokensテーブルで実現済み | ✅ |
| M3 | Medium | エラー情報漏洩 | auth/providers/google.ts | ✅ |
| M4 | Medium | R2キーにユーザーID | image/usecase.ts | ✅ |
| M6 | Medium | Google OAuth ID Token検証 | auth/providers/google.ts, domain.ts | ✅ |
| L1 | Low | 依存パッケージ監査 | package.json | ✅ |
| L2 | Low | AIエラー処理 | chat/usecase.ts | ✅ |

### スキップする項目
| # | 重大度 | 項目 | 理由 |
|---|--------|------|------|
| H2 | High | レート制限 | KV設定が必要、後日対応 |
| H6 | High | X-Dev-User-Id | ローカル環境のみで問題なし |
| M2 | Medium | OCR暗号化 | 大規模変更、試験問題なので優先度低 |
| M5 | Medium | Refresh Token | 実装済み |
| H10 | High | JWT有効期限 | 15分に設定済み |

---

## 修正詳細

### H1. 認可漏れ（メッセージ評価） ✅

**問題**: `/messages/:messageId/evaluate` が所有権チェックなし

**修正内容**:
- `getMessageForEvaluation`にuserIdパラメータを追加
- セッション経由で所有権チェック
- 不正アクセス時は403を返却

---

### H3/H4. 入力サイズ制限・MIME Type バリデーション ✅

**修正内容**:
- `content`: max(10000)
- `ocrResult`: max(50000)
- `mimeType`: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"])
- `filename`: max(255)

---

### H5/M4. ファイル名サニタイゼーション・R2キー修正 ✅

**修正内容**:
```typescript
const sanitizeFilename = (filename: string): string => {
  const basename = filename.split(/[\\/]/).pop() || "file"
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)
}

const r2Key = `images/${imageId}/${safeFilename}`  // userIdを除去
```

---

### M1. セッション管理 ✅

**状況**: refreshTokensテーブルで実現済み

- 各デバイス/ブラウザは独立したリフレッシュトークンを持つ
- ログアウト時は該当トークンのみ削除
- 他デバイスに影響なし

追加で欲しい機能（将来対応）:
- ログイン中のデバイス一覧UI
- 他デバイスを強制ログアウト機能

---

### M3. エラー情報漏洩 ✅

**修正内容**:
- ステータスコードを内部ログに出力
- ユーザーには抽象化されたエラーメッセージを返却

---

### M6. Google OAuth ID Token検証 ✅

**修正内容**:
- `jose`パッケージを追加
- userinfo v2エンドポイント → ID Token検証に変更
- Google公開鍵（JWKS）で署名検証
- issuer, audienceの検証

```typescript
const JWKS = jose.createRemoteJWKSet(new URL(GOOGLE_JWKS_URI))
const { payload } = await jose.jwtVerify(id_token, JWKS, {
  issuer: ["https://accounts.google.com", "accounts.google.com"],
  audience: config.clientId,
})
```

---

### L1. 依存パッケージ監査 ✅

**修正内容**: `pnpm audit`スクリプト追加

---

### L2. AIエラー処理 ✅

**修正内容**: ストリーミング中のエラーをキャッチしてユーザーに通知

---

## 修正対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `packages/shared/src/schemas/image.ts` | max制限、MIME enum |
| `apps/api/src/features/chat/route.ts` | 認可チェック追加、入力制限 |
| `apps/api/src/features/chat/usecase.ts` | getMessageForEvaluation修正、AIエラー処理 |
| `apps/api/src/features/image/usecase.ts` | ファイル名サニタイズ、R2キー変更 |
| `apps/api/src/features/auth/domain.ts` | OAuthTokens.id_token追加、getUserInfo引数変更 |
| `apps/api/src/features/auth/providers/google.ts` | ID Token検証実装 |
| `apps/api/src/features/auth/usecase.ts` | getUserInfo呼び出し修正 |
| `package.json`（ルート） | auditスクリプト追加 |
| `apps/api/package.json` | jose追加 |

---

## 検証方法

1. **型チェック**: `pnpm --filter @cpa-study/api typecheck` ✅
2. **手動確認**:
   - OAuth認証フローが正常に動作すること
   - メッセージ評価で他ユーザーのメッセージにアクセスできないこと
   - 長すぎるcontentでバリデーションエラーになること
   - 不正なMIME Typeでバリデーションエラーになること
