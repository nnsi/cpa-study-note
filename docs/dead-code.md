# Dead Code Report

Generated: 2026-02-04 (Cleaned: 14:45)

TypeScript `--noUnusedLocals --noUnusedParameters` で検出した未使用コードを削除済み。

## 削除した未使用コード

### API (`apps/api/src`)

| ファイル | 削除内容 |
|----------|----------|
| `features/chat/usecase.ts` | 未使用型 `ChatMessage` |
| `features/metrics/route.ts` | 未使用import `handleResult`, 未使用引数 `env` |
| `features/note/route.ts` | 未使用import `z`, `handleResult` |
| `features/subject/repository.ts` | 未使用import `topicCheckHistory` |
| `shared/lib/rate-limit/stores/durable-object.ts` | 未使用型 `RateLimitConfig`, `RateLimitResult` |
| `shared/lib/rate-limit/stores/memory.ts` | 未使用型 `RateLimitResult` |

### Web (`apps/web/src`)

| ファイル | 削除内容 |
|----------|----------|
| `features/bookmark/components/BookmarksList.tsx` | 未使用型 `BookmarkTargetType`, 未使用引数 `emptyMessage` |
| `features/image/hooks.ts` | 未使用変数 `uploadUrl` |
| `features/subject/components/TreeEditor.tsx` | 未使用型 `CategoryNode`, 未使用引数 `subjectName` |
| `features/subject/hooks/useTreeState.ts` | 未使用型 `SubcategoryNode`, `TopicNode`, `SubcategoryNodeInput`, 未使用変数 `generateTempId` |
| `lib/toast.tsx` | 未使用import `useEffect` |
| `routes/login.tsx` | 未使用変数 `isLoading` |

### Packages (`packages/`)

| ファイル | 削除内容 |
|----------|----------|
| `db/src/schema/bookmark.ts` | 未使用import `subjects`, `categories`, `topics` |

### テストコード

| ファイル | 削除内容 |
|----------|----------|
| `features/auth/repository.test.ts` | 未使用変数 `resetDb` |
| `features/auth/route.test.ts` | 未使用import `vi`, `jwtVerify`, `authMiddleware` |
| `features/auth/usecase.test.ts` | 未使用変数 `savedToken`, `tokenHash2` |
| `features/chat/route.test.ts` | 未使用import `vi`, `createMockAIAdapter` |
| `features/chat/usecase.test.ts` | 未使用import `vi` |
| `features/image/route.test.ts` | 未使用import `createMockAIAdapter`, `MAGIC_BYTES`, 型import, 未使用関数 `createJpegBuffer` |
| `features/image/usecase.test.ts` | 未使用import `beforeEach` |
| `features/learning/route.test.ts` | 未使用import `createTestUser` |
| `features/metrics/route.test.ts` | 未使用変数 `errorResponseSchema` |
| `features/note/route.test.ts` | 未使用import `createMockAIAdapter` |
| `features/subject/route.test.ts` | 未使用import `authMiddleware` |
| `features/view/route.test.ts` | 未使用変数 `additionalData` |
| `test/e2e/learning-flow.test.ts` | 未使用スキーマ変数多数 |
| `test/e2e/multi-user-boundary.test.ts` | 未使用変数 `userABookmarkSubjectId` |
| Web `features/image/hooks.test.ts` | 未使用引数 `size` → `_size` に変更 |

## 検出コマンド

```bash
# API (strict mode)
npx tsc -p apps/api/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters

# Web (strict mode)
npx tsc -p apps/web/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters
```

## 備考

- 削除後、全ての型チェックが通ることを確認済み
- `metrics/route.ts` の `env` 引数削除に伴い、`metrics/index.ts` と呼び出し箇所も修正
