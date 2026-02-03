# Dead Code Report

Generated: 2026-02-04

TypeScript `--noUnusedLocals --noUnusedParameters` で検出した未使用コード一覧。

## 本番コード（要修正）

### API (`apps/api/src`)

| ファイル | 行 | 種別 | 対象 |
|----------|-----|------|------|
| `features/chat/usecase.ts` | 2 | 未使用型 | `ChatMessage` |
| `features/learning/route.ts` | 7 | 未使用import | `handleResult` |
| `features/metrics/route.ts` | 10 | 未使用import | `handleResult` |
| `features/metrics/route.ts` | 17 | 未使用引数 | `env` |
| `features/note/route.ts` | 3 | 未使用import | `z` |
| `features/note/route.ts` | 26 | 未使用import | `handleResult` |
| `features/subject/repository.ts` | 9 | 未使用import | `topicCheckHistory` |
| `shared/lib/rate-limit/stores/durable-object.ts` | 9-10 | 未使用型 | `RateLimitConfig`, `RateLimitResult` |
| `shared/lib/rate-limit/stores/memory.ts` | 10 | 未使用型 | `RateLimitResult` |

### Web (`apps/web/src`)

| ファイル | 行 | 種別 | 対象 |
|----------|-----|------|------|
| `features/bookmark/components/BookmarksList.tsx` | 3 | 未使用型 | `BookmarkTargetType` |
| `features/bookmark/components/BookmarksList.tsx` | 57 | 未使用変数 | `emptyMessage` |
| `features/image/hooks.ts` | 52 | 未使用変数 | `uploadUrl` |
| `features/subject/components/TreeEditor.tsx` | 4 | 未使用型 | `CategoryNode` |
| `features/subject/components/TreeEditor.tsx` | 14 | 未使用引数 | `subjectName` |
| `features/subject/hooks/useTreeState.ts` | 4-5 | 未使用型 | `SubcategoryNode`, `TopicNode` |
| `features/subject/hooks/useTreeState.ts` | 7 | 未使用型 | `SubcategoryNodeInput` |
| `features/subject/hooks/useTreeState.ts` | 17 | 未使用変数 | `generateTempId` |
| `lib/toast.tsx` | 2 | 未使用import | `useEffect` |
| `routes/login.tsx` | 39 | 未使用変数 | `isLoading` |

### Packages (`packages/`)

| ファイル | 行 | 種別 | 対象 |
|----------|-----|------|------|
| `db/src/schema/bookmark.ts` | 3-5 | 未使用import | `subjects`, `categories`, `topics` |

## テストコード（低優先度）

テストファイルの未使用コードは動作に影響しないが、コードの明瞭さのため整理推奨。

### API Tests

| ファイル | 対象 |
|----------|------|
| `features/auth/repository.test.ts:8` | `resetDb` |
| `features/auth/route.test.ts:2,4,278` | `vi`, `jwtVerify`, `authMiddleware` |
| `features/auth/usecase.test.ts:272,331` | `savedToken`, `tokenHash2` |
| `features/chat/route.test.ts:2,13` | `vi`, `createMockAIAdapter` |
| `features/chat/usecase.test.ts:2` | `vi` |
| `features/image/route.test.ts:19-21,190` | `createMockAIAdapter`, `MAGIC_BYTES`, 未使用import全体, `createJpegBuffer` |
| `features/image/usecase.test.ts:4` | `beforeEach` |
| `features/learning/route.test.ts:15` | `createTestUser` |
| `features/metrics/route.test.ts:17` | `errorResponseSchema` |
| `features/note/route.test.ts:19` | `createMockAIAdapter` |
| `features/subject/route.test.ts:17` | `authMiddleware` |
| `features/view/route.test.ts:478` | `additionalData` |

### E2E Tests

| ファイル | 対象 |
|----------|------|
| `test/e2e/learning-flow.test.ts:39-70` | 複数の未使用スキーマ変数 |
| `test/e2e/multi-user-boundary.test.ts:417` | `userABookmarkSubjectId` |

### Web Tests

| ファイル | 対象 |
|----------|------|
| `features/image/hooks.test.ts:46` | `size` |

## 推奨アクション

1. **本番コード**: 即時削除を推奨
2. **テストコード**: リファクタリング時に整理
3. **型のみの未使用**: `type` import に変更するか削除

## 検出コマンド

```bash
# API
npx tsc -p apps/api/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters

# Web
npx tsc -p apps/web/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters
```
