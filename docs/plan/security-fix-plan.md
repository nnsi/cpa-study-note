# セキュリティレビュー修正計画

## 対象項目

### 実装する項目
| # | 重大度 | 項目 | 修正箇所 |
|---|--------|------|----------|
| H1 | High | 認可漏れ（メッセージ評価） | chat/route.ts, chat/usecase.ts |
| H3 | High | 入力サイズ制限なし | schemas/chat.ts, note.ts, image.ts |
| H4 | High | MIME Type バリデーション | schemas/image.ts |
| H5 | High | ファイル名サニタイゼーション | image/usecase.ts |
| M3 | Medium | エラー情報漏洩 | auth/providers/google.ts |
| M4 | Medium | R2キーにユーザーID | image/usecase.ts |
| L1 | Low | 依存パッケージ監査 | package.json |
| L2 | Low | AIエラー処理 | chat/usecase.ts |

### スキップする項目
- H2. レート制限（ユーザー指示）
- H6. X-Dev-User-Id（ローカル環境のみで問題なし）
- M1. セッションテーブル（大規模変更）
- M2. OCR暗号化（大規模変更）
- M5. Refresh Token（実装済み）
- M6. Google OAuth ID Token検証（大規模変更）
- H10. JWT有効期限（15分に設定済み）

---

## 修正詳細

### H1. 認可漏れ（メッセージ評価）

**問題**: `/messages/:messageId/evaluate` が所有権チェックなし

**修正ファイル**:
- `apps/api/src/features/chat/usecase.ts`
- `apps/api/src/features/chat/route.ts`

**修正内容**:
```typescript
// usecase.ts - getMessageForEvaluationにuserIdを追加
export const getMessageForEvaluation = async (
  deps: Pick<ChatDeps, "chatRepo">,
  userId: string,  // 追加
  messageId: string
): Promise<Result<{ content: string }, "NOT_FOUND" | "FORBIDDEN">> => {
  const message = await deps.chatRepo.findMessageById(messageId)
  if (!message) return err("NOT_FOUND")

  const session = await deps.chatRepo.findSessionById(message.sessionId)
  if (!session || session.userId !== userId) return err("FORBIDDEN")

  return ok({ content: message.content })
}

// route.ts - userIdを渡す
const user = c.get("user")
const result = await getMessageForEvaluation({ chatRepo }, user.id, messageId)
if (!result.ok) {
  return c.json({ error: result.error }, result.error === "NOT_FOUND" ? 404 : 403)
}
```

---

### H3. 入力サイズ制限

**修正ファイル**:
- `packages/shared/src/schemas/chat.ts`
- `packages/shared/src/schemas/note.ts`
- `packages/shared/src/schemas/image.ts`

**修正内容**:
```typescript
// chat.ts
export const sendMessageRequestSchema = z.object({
  content: z.string().min(1).max(10000),
  imageId: z.string().optional(),
})

// note.ts
export const updateNoteRequestSchema = z.object({
  userMemo: z.string().max(50000).optional(),
  keyPoints: z.array(z.string().max(1000)).max(50).optional(),
  stumbledPoints: z.array(z.string().max(1000)).max(50).optional(),
})

// image.ts
export const uploadImageRequestSchema = z.object({
  filename: z.string().max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
})
```

---

### H4. MIME Type バリデーション

**修正ファイル**: `packages/shared/src/schemas/image.ts`

**修正内容**: H3と同時に対応（z.enumでホワイトリスト化）

---

### H5. ファイル名サニタイゼーション

**修正ファイル**: `apps/api/src/features/image/usecase.ts`

**修正内容**:
```typescript
// usecase.ts
const sanitizeFilename = (filename: string): string => {
  const basename = filename.split(/[\\/]/).pop() || "file"
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)
}

// 使用箇所
const safeFilename = sanitizeFilename(filename)
const r2Key = `images/${imageId}/${safeFilename}`  // userIdも除去(M4)
```

---

### M3. エラー情報漏洩

**修正ファイル**: `apps/api/src/features/auth/providers/google.ts`

**修正内容**:
```typescript
// 修正前
throw new Error(`Token exchange failed: ${res.status}`)

// 修正後
console.error(`[Google OAuth] Token exchange failed: ${res.status}`)
throw new Error("Authentication failed")
```

---

### M4. R2キーからユーザーID除去

**修正ファイル**: `apps/api/src/features/image/usecase.ts`

**修正内容**: H5と同時に対応
```typescript
// 修正前
const r2Key = `images/${userId}/${imageId}/${filename}`

// 修正後
const r2Key = `images/${imageId}/${safeFilename}`
```

---

### L1. 依存パッケージ監査

**修正ファイル**: `package.json`（ルート）

**修正内容**:
```json
"scripts": {
  "audit": "pnpm audit --audit-level moderate"
}
```

---

### L2. AIエラー処理

**修正ファイル**: `apps/api/src/features/chat/usecase.ts`

**修正内容**: ストリーミング中のエラーをキャッチしてユーザーに通知
```typescript
try {
  for await (const chunk of deps.aiAdapter.streamText({ ... })) {
    // ...
  }
} catch (error) {
  console.error("[AI] Stream error:", error)
  yield { type: "error", content: "AI応答中にエラーが発生しました" }
}
```

---

## 修正対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `packages/shared/src/schemas/chat.ts` | max制限追加 |
| `packages/shared/src/schemas/note.ts` | max制限追加 |
| `packages/shared/src/schemas/image.ts` | max制限、MIME enum |
| `apps/api/src/features/chat/route.ts` | 認可チェック追加 |
| `apps/api/src/features/chat/usecase.ts` | getMessageForEvaluation修正、AIエラー処理 |
| `apps/api/src/features/image/usecase.ts` | ファイル名サニタイズ、R2キー変更 |
| `apps/api/src/features/auth/providers/google.ts` | エラーメッセージ修正 |
| `package.json`（ルート） | auditスクリプト追加 |

---

## 検証方法

1. **型チェック**: `pnpm check-types`
2. **既存テストがあれば実行**
3. **手動確認**:
   - メッセージ評価で他ユーザーのメッセージにアクセスできないこと
   - 長すぎるcontentでバリデーションエラーになること
   - 不正なMIME Typeでバリデーションエラーになること
