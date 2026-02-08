# Result/Error 統一方針

## 背景

現状、feature間でResult/Errorの流儀が統一されておらず、以下の問題が発生している：

- Result型: 共通import / ローカル再定義 / 独自shape / 不使用が混在
- エラー型: 大文字スネーク / オブジェクト`{type, message}` / 文字列 / boolean が混在
- ステータスコード: UseCase内 / Route層でmap / 手動分岐 が混在
- 横断的拡張（共通エラーハンドリング、ログ、メトリクス）が困難

## 統一方針

### 1. Result型の統一

**全UseCaseで `@/shared/lib/result` の共通Result型を使用する**

```typescript
// apps/api/src/shared/lib/result.ts（既存）
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })
```

UseCase内でのローカル再定義は禁止。必ずimportする。

```typescript
// Good
import { ok, err, type Result } from "@/shared/lib/result"

// Bad - ローカル再定義
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

### 2. エラー型の標準化

**タグ付きユニオン型 `AppError` を共通定義し、全featureで使用する**

```typescript
// apps/api/src/shared/lib/errors.ts（新規作成）

// HTTPステータスコードに対応するエラーコード
export type ErrorCode =
  | "NOT_FOUND"        // 404
  | "FORBIDDEN"        // 403
  | "UNAUTHORIZED"     // 401
  | "BAD_REQUEST"      // 400
  | "CONFLICT"         // 409
  | "INTERNAL_ERROR"   // 500

// アプリケーション共通エラー型
export type AppError = {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>  // 追加情報（デバッグ用）
}

// エラー生成ヘルパー
export const notFound = (message: string, details?: Record<string, unknown>): AppError => ({
  code: "NOT_FOUND",
  message,
  details,
})

export const forbidden = (message: string, details?: Record<string, unknown>): AppError => ({
  code: "FORBIDDEN",
  message,
  details,
})

export const badRequest = (message: string, details?: Record<string, unknown>): AppError => ({
  code: "BAD_REQUEST",
  message,
  details,
})

export const conflict = (message: string, details?: Record<string, unknown>): AppError => ({
  code: "CONFLICT",
  message,
  details,
})

export const unauthorized = (message: string, details?: Record<string, unknown>): AppError => ({
  code: "UNAUTHORIZED",
  message,
  details,
})

export const internalError = (message: string, details?: Record<string, unknown>): AppError => ({
  code: "INTERNAL_ERROR",
  message,
  details,
})

// コード → HTTPステータスのマッピング
export const errorCodeToStatus: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
}
```

### 3. UseCase層の実装パターン

**UseCaseは `Result<T, AppError>` を返す**

```typescript
// apps/api/src/features/subject/usecase.ts

import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, conflict, type AppError } from "@/shared/lib/errors"

export const deleteSubject = async (
  deps: SubjectUseCaseDeps,
  userId: string,
  subjectId: string
): Promise<Result<void, AppError>> => {
  const subject = await deps.repo.findById(userId, subjectId)

  if (!subject) {
    return err(notFound("科目が見つかりません", { subjectId }))
  }

  const hasCategories = await deps.repo.hasCategories(subjectId)
  if (hasCategories) {
    return err(conflict("カテゴリが存在するため削除できません", { subjectId }))
  }

  await deps.repo.delete(subjectId)
  return ok(undefined)
}
```

### 4. Route層の統一変換

**共通ヘルパー `handleResult` でエラーをHTTPレスポンスに変換する**

```typescript
// apps/api/src/shared/lib/route-helpers.ts（新規作成）

import type { Context } from "hono"
import type { Result } from "./result"
import { type AppError, errorCodeToStatus } from "./errors"

// Result → HTTPレスポンス変換
export const handleResult = <T>(
  c: Context,
  result: Result<T, AppError>,
  successStatus: 200 | 201 | 204 = 200
) => {
  if (result.ok) {
    if (successStatus === 204 || result.value === undefined) {
      return c.body(null, 204)
    }
    return c.json(result.value, successStatus)
  }

  const status = errorCodeToStatus[result.error.code]
  return c.json(
    {
      error: {
        code: result.error.code,
        message: result.error.message,
        ...(result.error.details && { details: result.error.details }),
      },
    },
    status as 400 | 401 | 403 | 404 | 409 | 500
  )
}

// 例: Route内での使用
// return handleResult(c, result)
// return handleResult(c, result, 201)  // 作成時
```

Route層の実装例：

```typescript
// apps/api/src/features/subject/route.ts

import { handleResult } from "@/shared/lib/route-helpers"

app.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user")
  const { id } = c.req.param()

  const result = await deleteSubject(deps, user.id, id)
  return handleResult(c, result)
})
```

### 5. feature固有エラーの扱い

feature固有のエラーコードが必要な場合、`details`で表現する。
ErrorCode自体は増やさない（HTTPステータスに対応する汎用コードに限定）。

```typescript
// feature固有の情報はdetailsに入れる
return err(conflict("削除できません", {
  reason: "HAS_CATEGORIES",  // feature固有の理由
  categoryCount: 5,
}))
```

### 6. ストリーミング（SSE）のエラー

ストリーミングは別扱いとする。エラーチャンクの形式は統一する。

```typescript
// apps/api/src/shared/lib/ai.ts

export type StreamErrorChunk = {
  type: "error"
  error: {
    code: ErrorCode
    message: string
  }
}

// ストリーム内でエラーを送出
yield { type: "error", error: { code: "NOT_FOUND", message: "Topic not found" } }
```

### 7. エラーメッセージの言語

**日本語で統一する**（UIがすべて日本語のため）

```typescript
// Good
return err(notFound("科目が見つかりません"))

// Bad
return err(notFound("Subject not found"))
```

## 移行計画

### Phase 1: 共通モジュール作成
1. `apps/api/src/shared/lib/errors.ts` を作成
2. `apps/api/src/shared/lib/route-helpers.ts` を作成
3. 既存の `result.ts` はそのまま活用

### Phase 2: 新規feature適用
- 新しく作成するfeatureは必ずこの方針に従う

### Phase 3: 既存feature移行（優先度順）
1. `subject` - 既にResult型使用、エラー型のみ変更
2. `study-domain` - ローカルResult削除、エラー型変更
3. `note` - 独自shape→共通Result+AppError
4. `chat` - 独自shape→共通Result+AppError（ストリーム部分は別対応）
5. `image` - 独自shape→共通Result+AppError
6. `auth` - 既存パターン→AppError移行
7. `bookmark` - boolean→Result+AppError
8. `metrics` - 独自shape→共通Result+AppError

## チェックリスト

新規feature作成時：
- [ ] `@/shared/lib/result` からResult型をimport
- [ ] `@/shared/lib/errors` からエラーヘルパーをimport
- [ ] UseCaseは `Result<T, AppError>` を返す
- [ ] Route層は `handleResult` で統一変換
- [ ] エラーメッセージは日本語

既存feature移行時：
- [ ] ローカルResult定義を削除
- [ ] エラー型をAppErrorに変更
- [ ] Route層のエラーハンドリングを `handleResult` に置換
- [ ] 型エラーがないことを確認
- [ ] 動作確認（正常系・エラー系両方）
