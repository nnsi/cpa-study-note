# Tracerデコレータリファクタリング計画

## Context

UseCaseが `Tracer` を直接依存として受け取り、全てのrepo/AI呼び出しを `tracer.span()` でラップしている。
横断的関心事（トレーシング）がビジネスロジック層に侵入している問題を、Decoratorパターンで解消する。

**方針**: `traced` ヘルパー + Per-repo traced factory（型安全、`as` ゼロ）

**ハイブリッド方式**: 個別repo/AI呼び出しはDecoratorで透過的にトレースし、トランザクション境界スパン（`d1.updateTreeTx`）のみUseCaseに `tracer` を残す。composite span（`Promise.all` をまとめるだけのスパン）は廃止し、個別メソッドのDecorator計測に置き換える（粒度が向上する）。

## `this` バインディングの安全性

本プロジェクトの全repositoryは `createXxxRepository(db): XxxRepository => ({...})` パターンでプレーンオブジェクト+アロー関数として生成される。アロー関数は独自の `this` を持たず `db` をクロージャでキャプチャするため、`traced` ヘルパーが `fn(...args)` で呼び出しても `this` バインディングの問題は発生しない。

---

## 対象範囲

### Decorator導入（tracerをUseCaseから除去）: 8 features

| Feature | Repos to decorate | AI | 特記 |
|---------|-------------------|----|------|
| bookmark | BookmarkRepository | - | |
| subject | SubjectRepository | - | usecase.ts: tracer完全除去。tree-usecase.ts: `d1.updateTreeTx`のみtracer残存（後述） |
| study-domain | StudyDomainRepository | - | |
| learning | LearningRepository, SubjectRepository | - | `getSubjectProgressStats`がSubjectRepoを使用。composite span `d1.findSubjectsAndProgress` は廃止（個別計測に置換） |
| metrics | MetricsRepository | - | |
| auth | AuthRepository | - | `db`と`tracer`を除去、`createSampleData`を依存に追加。`AuthDeps`と`AuthRepoDeps`両方修正 |
| note | NoteRepository, ChatRepository, SubjectRepository | generateText | `createManualNote`がSubjectRepoを使用。AI span: `ai.noteSummary` |
| quick-chat | QuickChatRepository | generateText | AI span: `ai.quickChatSuggest` |

### tree-usecase.ts の特殊対応

`tree-usecase.ts` は以下の理由で `tracer` を **部分的に** 残す:

- `updateSubjectTree` 内のトランザクション全体を `tracer.span("d1.updateTreeTx", ...)` でラップ → **維持**
  - トランザクション内の `txRepo = createSubjectRepository(tx)` は生のrepoであり、Decorated repoではない
  - 個別のtx内操作（upsertCategory等）は外側のtxスパンでカバーされるため個別計測不要
- Pre-tx の個別repo呼び出し（`findSubjectByIdAndUserId`, `findCategoriesBySubjectId` 等）→ Decorated repoが担当、**手動span除去**
- Composite span `d1.findExistingIds`（Promise.allラッパー）→ **廃止**、個別メソッド `findExistingCategoryIds` / `findExistingTopicIds` がDecorator計測

**変更後の `TreeDeps`**:
```typescript
export type TreeDeps = {
  subjectRepo: SubjectRepository  // Decorated repo（route層で注入）
  db: Db
  txRunner?: SimpleTransactionRunner
  logger: Logger
  tracer: Tracer  // d1.updateTreeTxのみに使用
}
```

### auth feature の詳細

**UseCase deps 変更**:

| 型 | Before | After |
|----|--------|-------|
| `AuthDeps` | `{ repo, providers, db, logger, tracer }` | `{ repo, providers, createSampleData, logger }` |
| `AuthRepoDeps` | `{ repo, logger, tracer }` | `{ repo, logger }` |

**影響する関数（全5つ）**:
- `handleOAuthCallback` (AuthDeps) — `db`→`createSampleData`、tracer除去
- `getOrCreateDevUser` (AuthRepoDeps) — tracer除去
- `saveRefreshToken` (AuthRepoDeps) — tracer除去
- `logout` (AuthRepoDeps) — tracer除去
- `refreshAccessToken` (AuthRepoDeps) — tracer除去

**Route側の変更（全4エンドポイント）**:
- `/:provider/callback` — `tracedAuthRepo(repo, tracer)` + `tracedSampleData`
- `/refresh` — `tracedAuthRepo(repo, tracer)`
- `/dev-login` — `tracedAuthRepo(repo, tracer)`
- `/logout` — `tracedAuthRepo(repo, tracer)`

### refreshNoteFromSession の計測改善

現状 `refreshNoteFromSession` は一部のrepo呼び出し（`noteRepo.findById` L345, `chatRepo.findMessagesBySession` L358）に `tracer.span` が未適用。Decorator導入後はこれらも自動的にトレースされるため、**計測カバレッジが向上**する。

### 対象外（現状維持）
- **chat, topic-generator, study-plan/ai-usecase**: streaming（`addSpan`/`getSummary`使用）
- **exercise, image**: R2直接アクセス + 複数AI span名の使い分けがありデコレータ化が複雑
- **view, study-plan/usecase**: 既にtracerなし

### chat featureの非streaming関数について

chat featureには `findSessionById`, `findMessagesBySession` など非streamingの関数があるが、`ChatDeps` 型が streaming関数と共有されているため、今回はfeature全体を対象外とする。ただし、note featureが `ChatRepository` を使用するため、`tracedChatRepo` factory は作成する（note route で使用）。

---

## スパン名の変更 Before/After

Decorator化により、スパン名がメソッド名ベースに統一される。`getSummary()` は `d1.*` / `ai.*` プレフィックスで集計するため、**集計結果への影響はない**。

### bookmark
| Before | After |
|--------|-------|
| `d1.findBookmarks` | `d1.findBookmarksByUser` |
| `d1.addBookmark` | `d1.addBookmark` (同一) |
| `d1.removeBookmark` | `d1.removeBookmark` (同一) |
| `d1.targetExists` | `d1.targetExists` (同一) |
| `d1.getBookmarkDetails` | `d1.getBookmarkDetails` (同一) |
| （未計測: isBookmarked） | `d1.isBookmarked` | **新規追加** |

### subject (usecase.ts)
| Before | After |
|--------|-------|
| `d1.verifyDomainOwnership` | `d1.verifyStudyDomainOwnership` |
| `d1.findSubjects` | `d1.findByStudyDomainId` |
| `d1.getBatchStats` | `d1.getBatchSubjectStats` |
| `d1.findSubject` | `d1.findById` |
| `d1.createSubject` | `d1.create` |
| `d1.updateSubject` | `d1.update` |
| `d1.softDeleteSubject` | `d1.softDelete` |

### subject (tree-usecase.ts)
| Before | After | 備考 |
|--------|-------|------|
| `d1.findSubject` | `d1.findSubjectByIdAndUserId` | Decorator |
| `d1.findCategories` | `d1.findCategoriesBySubjectId` | Decorator |
| `d1.findTopics` | `d1.findTopicsByCategoryIds` | Decorator |
| `d1.findCategoryIds` | `d1.findCategoryIdsBySubjectIdWithSoftDeleted` | Decorator |
| `d1.findTopicIds` | `d1.findTopicIdsBySubjectWithSoftDeleted` | Decorator |
| `d1.findExistingIds` | （廃止）→ `d1.findExistingCategoryIds` + `d1.findExistingTopicIds` | composite→個別 |
| `d1.updateTreeTx` | `d1.updateTreeTx` (同一) | 手動span維持 |
| `d1.verifyDomainOwnership` | `d1.verifyStudyDomainOwnership` | Decorator |
| `d1.findSubjects` (bulkImport) | `d1.findByStudyDomainId` | Decorator |
| `d1.createSubject` | `d1.create` | Decorator |

### learning
| Before | After | 備考 |
|--------|-------|------|
| `d1.verifyTopicExists` | `d1.verifyTopicExists` (同一) | |
| `d1.touchTopic` | `d1.touchTopic` (同一) | |
| `d1.findProgress` | `d1.findProgress` (同一) | |
| `d1.upsertProgress` | `d1.upsertProgress` (同一) | |
| `d1.createCheckHistory` | `d1.createCheckHistory` (同一) | |
| `d1.findProgressByUser` | `d1.findProgressByUser` (同一) | |
| `d1.findCheckHistory` | `d1.findCheckHistoryByTopic` | |
| `d1.findRecentTopics` | `d1.findRecentTopics` (同一) | |
| `d1.findSubjectsAndProgress` | （廃止）→ `d1.findAllSubjectsForUser` + `d1.getProgressCountsBySubject` | composite→個別 |
| `d1.getBatchStats` | `d1.getBatchSubjectStats` | |

### auth
| Before | After |
|--------|-------|
| `d1.findConnection` | `d1.findConnectionByProviderAndId` |
| `d1.findUserById` | `d1.findUserById` (同一) |
| `d1.findUserByEmail` | `d1.findUserByEmail` (同一) |
| `d1.createUser` (createUser) | `d1.createUser` (同一) |
| `d1.createUser` (createUserWithId) | `d1.createUserWithId` | getOrCreateDevUserで使用 |
| `d1.createConnection` | `d1.createConnection` (同一) |
| `d1.createSampleData` | `d1.createSampleData` (同一、route層で手動span) |
| `d1.updateDefaultDomain` | `d1.updateUser` | Decorated repo |
| `d1.saveRefreshToken` | `d1.saveRefreshToken` (同一) |
| `d1.findRefreshToken` | `d1.findRefreshTokenByHash` |
| `d1.deleteRefreshToken` | `d1.deleteRefreshToken` (同一) |

### note
| Before | After |
|--------|-------|
| `ai.noteSummary` | `ai.noteSummary` (同一) |
| `d1.createNote` | `d1.create` |
| `d1.findNote` | `d1.findById` / `d1.findByIdWithTopic` |
| `d1.findNotes` | `d1.findByUser` |
| `d1.findNotesByTopic` | `d1.findByTopic` |
| `d1.findNoteBySession` | `d1.findBySessionId` |
| `d1.updateNote` | `d1.update` |
| `d1.deleteNote` | `d1.softDelete` |
| `d1.findTopic` (createManualNote) | `d1.findTopicById` | SubjectRepo decorator |
| （未計測: noteRepo.findById L345） | `d1.findById` | **新規追加** |
| （未計測: chatRepo.findMessagesBySession L358） | `d1.findMessagesBySession` | **新規追加** |

### quick-chat
| Before | After |
|--------|-------|
| `d1.findAllTopicsByDomain` | `d1.findAllTopicsByDomain` (同一) |
| `ai.quickChatSuggest` | `ai.quickChatSuggest` (同一) |

---

## 実装手順

### Step 1: `traced` ヘルパーを `shared/lib/tracer.ts` に追加

```typescript
export const traced = <A extends unknown[], R>(
  tracer: Tracer,
  name: string,
  fn: (...args: A) => Promise<R>
): ((...args: A) => Promise<R>) =>
  (...args) => tracer.span(name, () => fn(...args))
```

**ファイル**: `apps/api/src/shared/lib/tracer.ts`

### Step 2: Per-repo traced factory を各 repository.ts に追加

各repositoryファイルの末尾に traced factory 関数を追加。返り値型をインターフェース型で明示（メソッド追加漏れをコンパイル時検知）。

対象ファイル:
- `apps/api/src/features/bookmark/repository.ts` → `tracedBookmarkRepo`
- `apps/api/src/features/subject/repository.ts` → `tracedSubjectRepo`
- `apps/api/src/features/study-domain/repository.ts` → `tracedStudyDomainRepo`
- `apps/api/src/features/learning/repository.ts` → `tracedLearningRepo`
- `apps/api/src/features/metrics/repository.ts` → `tracedMetricsRepo`
- `apps/api/src/features/auth/repository.ts` → `tracedAuthRepo`
- `apps/api/src/features/note/repository.ts` → `tracedNoteRepo`
- `apps/api/src/features/chat/repository.ts` → `tracedChatRepo`（note featureが使用）
- `apps/api/src/features/quick-chat/repository.ts` → `tracedQuickChatRepo`

例（bookmark）:
```typescript
export const tracedBookmarkRepo = (repo: BookmarkRepository, tracer: Tracer): BookmarkRepository => ({
  findBookmarksByUser: traced(tracer, "d1.findBookmarksByUser", repo.findBookmarksByUser),
  addBookmark: traced(tracer, "d1.addBookmark", repo.addBookmark),
  removeBookmark: traced(tracer, "d1.removeBookmark", repo.removeBookmark),
  isBookmarked: traced(tracer, "d1.isBookmarked", repo.isBookmarked),
  targetExists: traced(tracer, "d1.targetExists", repo.targetExists),
  getBookmarkDetails: traced(tracer, "d1.getBookmarkDetails", repo.getBookmarkDetails),
})
```

**SubjectRepository の注意点**: メソッド数が多い（30+）。全メソッドに `traced` を適用する。スパン名は `d1.<methodName>` で統一。

### Step 3: Traced AI adapter factory を追加

**ファイル**: `apps/api/src/shared/lib/ai/traced.ts`（新規）

```typescript
import type { AIAdapter } from "./types"
import type { Tracer } from "../tracer"
import { traced } from "../tracer"

export const tracedAIAdapter = (
  adapter: AIAdapter,
  tracer: Tracer,
  spanName: string
): AIAdapter => ({
  generateText: traced(tracer, spanName, adapter.generateText),
  streamText: adapter.streamText, // passthrough（decorator対象外）
})
```

### Step 4: UseCase deps から tracer を除去

各featureの `usecase.ts` を修正:
1. `tracer: Tracer` を deps 型から削除
2. `import type { Tracer }` を削除
3. `tracer.span("...", () => ...)` ラッピングを除去し、直接 repo/AI メソッドを呼ぶ
4. `Pick<XxxDeps, ... | "tracer">` から `"tracer"` を除去

**feature別の注意点**:

#### auth (`apps/api/src/features/auth/usecase.ts`)
- `AuthDeps`: `db: Db` と `tracer: Tracer` を削除、`createSampleData: (userId: string) => Promise<{ studyDomainId: string }>` を追加
- `AuthRepoDeps`: `tracer: Tracer` を削除
- `handleOAuthCallback`: `createSampleDataForNewUser(deps.db, ...)` → `deps.createSampleData(...)`
- `handleOAuthCallback`: `tracer.span("d1.updateDefaultDomain", () => deps.repo.updateUser(...))` → `deps.repo.updateUser(...)`（Decorated repo）
- `getOrCreateDevUser`, `saveRefreshToken`, `logout`, `refreshAccessToken`: 全てのtracer.span除去
- `import { createSampleDataForNewUser }` を削除（route層に移動）

#### learning (`apps/api/src/features/learning/usecase.ts`)
- `LearningDeps`: `tracer: Tracer` を削除
- `getSubjectProgressStats` の deps型: `{ subjectRepo: SubjectRepository; logger: Logger; tracer: Tracer }` → `{ subjectRepo: SubjectRepository; logger: Logger }`
- Composite span `d1.findSubjectsAndProgress` を除去し、`Promise.all` を直接呼ぶ（個別メソッドはDecorated repoで計測）

#### note (`apps/api/src/features/note/usecase.ts`)
- `NoteDeps`: `tracer: Tracer` を削除
- `createManualNote` の deps型: `{ noteRepo, subjectRepo, logger, tracer }` → `{ noteRepo, subjectRepo, logger }`
- 全 `Pick<NoteDeps, ... | "tracer">` から `"tracer"` を除去
- `refreshNoteFromSession`: L345 `noteRepo.findById`, L358 `chatRepo.findMessagesBySession` は元々traceなしだったが、Decorated repoにより自動計測される

#### subject/tree-usecase.ts (`apps/api/src/features/subject/tree-usecase.ts`)
- `TreeDeps` は `tracer: Tracer` を**残す**（`d1.updateTreeTx` 用）
- `getSubjectTree`: 全ての個別 `tracer.span(...)` を除去（Decorated repo）
- `updateSubjectTree`:
  - Pre-tx の個別 `tracer.span(...)` を除去（Decorated repo）
  - `tracer.span("d1.findExistingIds", () => Promise.all([...]))` → `Promise.all([subjectRepo.findExistingCategoryIds(...), subjectRepo.findExistingTopicIds(...)])` に変更（composite span廃止）
  - `tracer.span("d1.updateTreeTx", () => runInTransaction(...))` → **維持**
  - tx内の `txRepo` は生のrepo（Decorated ではない）。tx内の個別操作は外側の `d1.updateTreeTx` でカバー
- `bulkImportCSVToStudyDomain`: 全ての個別 `tracer.span(...)` を除去（Decorated repo）
- `importCSVToSubject`: 変更なし（`getSubjectTree`/`updateSubjectTree` を委譲するのみ）

### Step 5: Route を更新

各featureの `route.ts` を修正:
- ハンドラ内で `c.get("tracer")` を取得
- traced factory でラップした repos/AI adapter を usecase に渡す
- `tracer` を直接 usecase に渡さない（tree-usecaseのみ例外）

例（bookmark route）:
```typescript
// Before
const result = await getBookmarks({ repo, logger, tracer }, user.id)

// After
const result = await getBookmarks({ repo: tracedBookmarkRepo(repo, tracer), logger }, user.id)
```

#### auth route (`apps/api/src/features/auth/route.ts`) — 全4エンドポイント

```typescript
import { traced } from "@/shared/lib/tracer"
import { tracedAuthRepo } from "./repository"
import { createSampleDataForNewUser } from "./sample-data"

// /:provider/callback
const tracer = c.get("tracer")
const tracedSampleData = traced(tracer, "d1.createSampleData",
  (userId: string) => createSampleDataForNewUser(db, userId))
const result = await handleOAuthCallback(
  { repo: tracedAuthRepo(repo, tracer), providers, createSampleData: tracedSampleData, logger },
  providerName, code
)

// /refresh
const tracer = c.get("tracer")
const result = await refreshAccessToken(
  { repo: tracedAuthRepo(repo, tracer), logger },
  refreshToken, jwtSecret, generateAccessToken
)

// /dev-login
const tracer = c.get("tracer")
const userResult = await getOrCreateDevUser(
  { repo: tracedAuthRepo(repo, tracer), logger },
  { ... }
)

// /logout
const tracer = c.get("tracer")
const logoutResult = await logout({ repo: tracedAuthRepo(repo, tracer), logger }, tokenHash)
```

**`saveRefreshToken` もauth route内で呼ばれる** — callback, dev-login の両方で使用:
```typescript
const saveResult = await saveRefreshToken(
  { repo: tracedAuthRepo(repo, tracer), logger },
  { userId, tokenHash, expiresAt }
)
```

#### learning route — `getSubjectProgressStats` のSubjectRepo

```typescript
const tracer = c.get("tracer")
const result = await getSubjectProgressStats(
  { subjectRepo: tracedSubjectRepo(subjectRepo, tracer), logger },
  user.id
)
```

#### note route — SubjectRepo + ChatRepo

```typescript
// POST /manual
const result = await createManualNote(
  { noteRepo: tracedNoteRepo(noteRepo, tracer), subjectRepo: tracedSubjectRepo(subjectRepo, tracer), logger },
  { ... }
)

// POST / (createNoteFromSession)
const result = await createNoteFromSession(
  { noteRepo: tracedNoteRepo(noteRepo, tracer), chatRepo: tracedChatRepo(chatRepo, tracer),
    aiAdapter: tracedAIAdapter(aiAdapter, tracer, "ai.noteSummary"),
    noteSummaryConfig, logger },
  { userId, sessionId }
)

// POST /:noteId/refresh (refreshNoteFromSession)
const result = await refreshNoteFromSession(
  { noteRepo: tracedNoteRepo(noteRepo, tracer), chatRepo: tracedChatRepo(chatRepo, tracer),
    aiAdapter: tracedAIAdapter(aiAdapter, tracer, "ai.noteSummary"),
    noteSummaryConfig, logger },
  user.id, noteId
)

// GET系 (listNotes, listNotesByTopic, getNote, getNoteBySession, updateNote, deleteNote)
// Pick<NoteDeps, "noteRepo" | "logger"> を使用
const result = await listNotes({ noteRepo: tracedNoteRepo(noteRepo, tracer), logger }, user.id)
```

#### subject route — tree-usecase への tracer 渡し

tree-usecase の関数には引き続き tracer を渡す（`d1.updateTreeTx` 用）。ただし `subjectRepo` は Decorated 版を渡す:

```typescript
const tracer = c.get("tracer")
const treeDeps = {
  subjectRepo: tracedSubjectRepo(subjectRepo, tracer),
  db, txRunner, logger, tracer
}
const result = await updateSubjectTree(treeDeps, user.id, subjectId, tree)
```

### Step 6: テスト更新

各 `usecase.test.ts` から:
- `tracer: noopTracer` を deps から削除
- 不要になった `import { noopTracer }` を削除
- **例外**: tree-usecase テストは `tracer: noopTracer` を**残す**（`d1.updateTreeTx` 用）

**auth テスト特殊対応**:
- `createSampleData` のモックを追加: `createSampleData: vi.fn().mockResolvedValue({ studyDomainId: "..." })`
- `db` モックを削除
- `AuthRepoDeps` テスト: tracer 除去

### Step 7: 型チェック + 全テスト

実装後に以下を全て通すこと:

```bash
# 型チェック
pnpm --filter api exec tsc --noEmit

# 全テスト実行
pnpm --filter api test
pnpm --filter shared test
pnpm --filter web test
```

---

## 修正対象ファイル一覧

**共通**:
- `apps/api/src/shared/lib/tracer.ts`（traced helper追加）
- `apps/api/src/shared/lib/ai/traced.ts`（新規）

**Feature毎**:

| Feature | repository.ts | usecase.ts | route.ts | usecase.test.ts | その他 |
|---------|:---:|:---:|:---:|:---:|------|
| bookmark | traced factory追加 | tracer除去 | traced repo注入 | noopTracer除去 | |
| subject | traced factory追加 | tracer除去 | traced repo注入 | noopTracer除去 | tree-usecase.ts: 部分修正, tree-usecase.test.ts: tracer残存 |
| study-domain | traced factory追加 | tracer除去 | traced repo注入 | noopTracer除去 | |
| learning | traced factory追加 | tracer除去 | traced repo注入 | noopTracer除去 | |
| metrics | traced factory追加 | tracer除去 | traced repo注入 | noopTracer除去 | |
| auth | traced factory追加 | tracer+db除去, createSampleData追加 | 全4 endpoint修正 | noopTracer→createSampleDataモック | |
| note | traced factory追加 | tracer除去 | traced repo+AI注入 | noopTracer除去 | chat/repository.tsにtracedChatRepo追加 |
| quick-chat | traced factory追加 | tracer除去 | traced repo+AI注入 | noopTracer除去 | |

合計: 約35ファイル
