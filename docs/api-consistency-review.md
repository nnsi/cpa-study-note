# API コード一貫性レビュー

**実施日**: 2026-02-05
**対象**: `apps/api/src/features/` 全11機能モジュール

---

## サマリ

| 観点 | 指摘数 | Critical | High | Medium | Low |
|------|--------|----------|------|--------|-----|
| route.ts | 8 | 0 | 3 | 4 | 1 |
| usecase.ts | 8 | 0 | 2 | 4 | 2 |
| index.ts | 0 | 0 | 0 | 0 | 0 |
| スキーマ | 2 | 0 | 0 | 2 | 0 |
| Response型 | 2 | 0 | 1 | 1 | 0 |
| アーキテクチャ | 2 | 0 | 1 | 1 | 0 |
| **合計** | **22** | **0** | **7** | **12** | **3** |

---

## 1. route.ts の一貫性

### 1-1. [High] `errorResponse` が chat/route.ts に残存

**ファイル**: `chat/route.ts:21, 165`

```ts
import { handleResultWith, errorResponse } from "@/shared/lib/route-helpers"
// ...
return errorResponse(c, result.error)
```

**規約**: `handleResult(c, result)` を使用すべき。`errorResponse` は旧API。

**修正案**:
```ts
import { handleResult, handleResultWith } from "@/shared/lib/route-helpers"
// ...
return handleResult(c, result)
```

---

### 1-2. [High] `c.json({ success: true })` パターンの不統一

**ファイル**:
- `study-domain/route.ts:88` — DELETE 成功時
- `subject/route.ts:113` — DELETE 成功時
- `image/route.ts:73` — upload 成功時
- `auth/route.ts:313` — logout 成功時

```ts
return c.json({ success: true })
```

**問題**: `handleResult` を使う場合は `handleResult(c, result, 204)` で 204 No Content を返すのが一貫した方法（bookmark の DELETE では `handleResult(c, result, 204)` を使用している）。`{ success: true }` は非標準的なレスポンス形式。

**一貫しているもの**: `bookmark/route.ts:55` → `handleResult(c, result, 204)` ✅

---

### 1-3. [High] `c.json(result)` で handleResult を経由していない

**ファイル**: `image/route.ts:47`

```ts
const result = await createUploadUrl(...)
return c.json(result)
```

**問題**: `createUploadUrl` は `Result<T, AppError>` を返さず直接オブジェクトを返している。UseCase が Result 型を返さないのは一貫性違反（下記 usecase セクション参照）。

---

### 1-4. [Medium] DI パターンの不統一

**規約**: `const deps = { repo }` 形式で DI オブジェクトを構築してから UseCase に渡す。

| Feature | パターン | 準拠 |
|---------|---------|------|
| bookmark | `const deps = { repo }` | ✅ |
| study-domain | `const deps = { repo }` | ✅ |
| metrics | `const deps = { metricsRepo }` | ✅ |
| learning | `const deps = { learningRepo }` | ✅ |
| subject | `const deps = { subjectRepo }` | ✅ |
| view | `const deps = { topicViewRepo, ... }` | ✅ |
| **chat** | repo をインラインで渡す: `({ chatRepo, learningRepo }, ...)` | ❌ |
| **exercise** | repo をインラインで渡す: `({ exerciseRepo, imageRepo, ... }, ...)` | ❌ |
| **note** | repo をインラインで渡す: `({ noteRepo, chatRepo, ... }, ...)` | ❌ |
| **image** | repo をインラインで渡す: `({ imageRepo, ... }, ...)` | ❌ |
| **auth** | repo をインラインで渡す: `({ repo, providers, db }, ...)` | ❌ |

**備考**: chat/exercise/note/image/auth は AI アダプタや R2 など動的な依存が多いため、すべてを事前に `deps` にまとめるのが困難な場合がある。ただし、AI を使わないエンドポイント（`getSession`, `listMessages` 等）では `{ chatRepo }` を毎回インラインで渡しており、これは `deps` 変数を使えるはず。

---

### 1-5. [Medium] auth/route.ts で `c.json()` を直接使用（4箇所）

**ファイル**: `auth/route.ts:70, 76, 213, 284`

```ts
return c.json({ providers: providers.list() })     // :70
return c.json({ user })                             // :76
return c.json({ accessToken, user: ... })           // :213, 284
```

**理由**: auth は OAuth フローのため他の CRUD ルートとは性質が異なり、Result 型を返すのが不自然な箇所がある。`/providers` や `/me` のような単純取得、`/refresh` や `/dev-login` のトークン返却は `c.json()` で問題ないとも言えるが、他 feature との一貫性は損なわれている。

**判定**: auth のトークン返却は例外的に許容するか、`handleResultWith` でラップするかはプロジェクト方針次第。

---

### 1-6. [Medium] bookmark/route.ts の POST でステータスコード分岐

**ファイル**: `bookmark/route.ts:37-42`

```ts
if (!result.ok) {
  return handleResult(c, result)
}
const status = result.value.alreadyExists ? 200 : 201
return c.json({ bookmark: result.value.bookmark }, status)
```

**問題**: `handleResultWith` を使わず `c.json` で直接返している。冪等性のための 200/201 分岐は妥当だが、`handleResultWith` にカスタムステータスを渡す形が望ましい。

---

### 1-7. [Medium] route.ts 内の Deps 型定義の名前が feature ごとに不統一

| Feature | route.ts の Deps 型名 |
|---------|----------------------|
| auth | `AuthDeps` |
| bookmark | `BookmarkDeps` |
| chat | `ChatDeps` |
| exercise | `ExerciseDeps` |
| image | `ImageDeps` |
| learning | `LearningDeps` |
| note | `NoteDeps` |
| metrics | `MetricsDeps` |
| study-domain | `StudyDomainDeps` |
| subject | `SubjectRouteDeps` |
| view | `ViewDeps` |

**問題**: subject だけ `SubjectRouteDeps` で、他は `XxxDeps`。route 層と usecase 層で同名の Deps 型が定義されている feature もあり（chat, note, exercise, image, auth, learning）、混乱の原因になりうる。

---

### 1-8. [Low] exercise/route.ts の `handleResultWith(c, result, (data) => data)`

**ファイル**: `exercise/route.ts:110`

```ts
return handleResultWith(c, result, (data) => data)
```

identity transform は `handleResult(c, result)` と同義。

---

## 2. usecase.ts の一貫性

### 2-1. [High] Deps 型の export / 命名の不統一

**規約**: `export type XxxDeps = { ... }` 形式。

| Feature | Deps 型名 | export | 準拠 |
|---------|----------|--------|------|
| auth | `AuthDeps` + `AuthRepoDeps` | なし | ❌ (2型存在、未export) |
| bookmark | `BookmarkDeps` | あり | ✅ |
| chat | `ChatDeps` | あり | ✅ |
| exercise | `ExerciseDeps` | なし | ❌ (未export) |
| image | `ImageDeps` | なし | ❌ (未export) |
| learning | `LearningDeps` | あり | ✅ |
| metrics | `MetricsDeps` | あり | ✅ |
| note | `NoteDeps` | あり | ✅ |
| study-domain | `StudyDomainDeps` | なし | ❌ (未export) |
| subject | `SubjectDeps` | あり | ✅ |
| view | `ViewDeps` | あり | ✅ |

**未 export**: auth, exercise, image, study-domain — route.ts 側で使われていないなら実害は少ないが、慣習として export すべき。

**auth の特殊性**: `AuthDeps`（OAuth 用）と `AuthRepoDeps`（リポジトリ操作用）の2型がある。命名が `AuthRepoDeps` であり規約の `XxxDeps` 形式から逸脱。

---

### 2-2. [High] UseCase が Result 型を返さない関数がある

**規約**: 全 UseCase 関数は `Result<T, AppError>` を返す。

| 関数 | 返り値 | 準拠 |
|------|--------|------|
| `image/createUploadUrl` | `Promise<{ uploadUrl, imageId }>` | ❌ |

**問題**: DB 操作 (`imageRepo.create`) を含むのに try-catch も Result もない。DB エラー時にハンドリングされない。

---

### 2-3. [Medium] usecase 内のローカル Zod スキーマ

**規約**: Zod スキーマは `@cpa-study/shared/schemas` から import。

| ファイル | スキーマ | 理由 |
|---------|---------|------|
| `note/usecase.ts:17` | `noteSummaryParseSchema` | LLM 出力パース用（共有不要） |
| `chat/usecase.ts:383` | `evaluationSchema` | LLM 出力パース用（共有不要） |

**判定**: これらは LLM の出力をパースするための内部スキーマであり、API リクエスト/レスポンスのスキーマではない。shared に移動する必然性は低いが、規約上はグレー。LLM パース用スキーマは例外として明示的にルール化するのが望ましい。

---

### 2-4. [Medium] subject/usecase.ts のローカル型定義

**ファイル**: `subject/usecase.ts:33, 83, 117`

```ts
type SubjectWithStats = Subject & { categoryCount: number; topicCount: number }
export type CreateSubjectData = { ... }
export type UpdateSubjectData = { ... }
```

**問題**: `SubjectWithStats` は shared の Response 型として定義すべき可能性がある。`CreateSubjectData` / `UpdateSubjectData` は input 型であり shared のリクエストスキーマから推論する方が一貫性がある。

---

### 2-5. [Medium] 非 null アサーション (`!`) の使用

**ファイル**:
- `note/usecase.ts:266` — `toNoteWithSource(note!)`
- `note/usecase.ts:375` — `toNoteWithSource(note!)`

```ts
const note = await deps.noteRepo.update(noteId, input)
return ok(toNoteWithSource(note!))
```

**問題**: `noteRepo.update` が `null` を返す可能性があるなら、ハンドリングすべき。`!` は型安全性を損なう。

---

### 2-6. [Medium] DB エラーの try-catch が一部の feature にしかない

**規約**: DB エラーは try-catch で捕捉し `err(internalError(...))` を返す。

| Feature | try-catch 使用 | 備考 |
|---------|---------------|------|
| auth | ✅ | OAuth 外部呼び出し + サンプルデータ作成 |
| chat | ✅ | AI ストリーミング |
| exercise | ✅ | AI 呼び出し |
| note | ✅ | AI 呼び出し + DB 操作 |
| bookmark | ❌ | DB 操作を直接 await |
| image | ❌ | DB 操作を直接 await |
| learning | ❌ | DB 操作を直接 await |
| metrics | ❌ | DB 操作を直接 await |
| study-domain | ❌ | DB 操作を直接 await |
| subject | ❌ | DB 操作を直接 await |
| view | ❌ | DB 操作を直接 await |

**備考**: try-catch があるのは AI 外部呼び出しがある feature のみ。DB 操作のみの feature ではエラーがグローバルエラーハンドラに伝播する前提と思われるが、規約との乖離がある。これは「DB エラー時にどう振る舞うべきか」の方針を明確化すべき問題。

---

### 2-7. [Low] auth/usecase.ts の `hashToken` が route.ts にも存在

**ファイル**:
- `auth/route.ts:47-53` — `hashToken` 関数
- `auth/usecase.ts:99-105` — `hashToken` 関数（同一実装）

**問題**: 同一の実装が2箇所に存在。route.ts では OAuth コールバックと dev-login で使用し、usecase.ts では `refreshAccessToken` で使用。共通ユーティリティに抽出すべき。

---

### 2-8. [Low] learning/usecase.ts の `getSubjectProgressStats` のDeps が inline

**ファイル**: `learning/usecase.ts:164`

```ts
export const getSubjectProgressStats = async (
  deps: { subjectRepo: SubjectRepository },
  // ...
```

**問題**: 他の関数は `LearningDeps` を使っているが、この関数だけ inline で deps 型を定義している。`LearningDeps` に `subjectRepo` を追加するか、別の Deps 型を定義すべき。

---

## 3. index.ts の一貫性

### 全 feature 準拠 ✅

| Feature | シグネチャ | env 使用 | 準拠 |
|---------|----------|---------|------|
| auth | `(env: Env, db: Db)` | ✅ env 使用 | ✅ |
| bookmark | `(_env: Env, db: Db)` | ✅ 未使用 prefix | ✅ |
| chat | `(env: Env, db: Db)` | ✅ env 使用 | ✅ |
| exercise | `(env: Env, db: Db)` | ✅ env 使用 | ✅ |
| image | `(env: Env, db: Db)` | ✅ env 使用 | ✅ |
| learning | `(_env: Env, db: Db)` | ✅ 未使用 prefix | ✅ |
| metrics | `(_env: Env, db: Db)` | ✅ 未使用 prefix | ✅ |
| note | `(env: Env, db: Db)` | ✅ env 使用 | ✅ |
| study-domain | `(_env: Env, db: Db)` | ✅ 未使用 prefix | ✅ |
| subject | `(_env: Env, db: Db)` | ✅ 未使用 prefix | ✅ |
| view | `(_env: Env, db: Db)` | ✅ 未使用 prefix | ✅ |

---

## 4. スキーマの一貫性

### 4-1. [Medium] metrics/route.ts にローカル Zod スキーマ

**ファイル**: `metrics/route.ts:54`

```ts
zValidator("param", z.object({ date: dateStringSchema })),
```

**問題**: `z.object({ date: dateStringSchema })` がインラインで定義されている。`dateStringSchema` 自体は shared から import しているが、このバリデーション用のオブジェクトスキーマは shared で名前付きスキーマとして定義すべき。

---

### 4-2. [Medium] exercise/route.ts のバリデーションが Zod でなく手動

**ファイル**: `exercise/route.ts:40-61`

```ts
if (!imageFile || typeof imageFile === "string") { ... }
if (!ALLOWED_MIME_TYPES.includes(file.type)) { ... }
if (file.size > MAX_UPLOAD_SIZE) { ... }
```

**備考**: multipart/form-data の画像バリデーションは Zod で表現しにくいため、手動チェックは妥当。ただし、同様のチェックが `image/route.ts:52-59` にもあり、共通ユーティリティに抽出する余地がある。

---

## 5. Response 型の一貫性

### 5-1. [High] フロントエンドに `as Promise<T>` が残存

**ファイル**: `apps/web/src/routes/exercises/index.tsx:47`

```ts
return res.json() as Promise<SearchTopicsResponse>
```

**規約**: `as Promise<T>` は禁止。`xxxSchema.parse(json)` を使用すべき。

**備考**: 他のフロントエンド API ファイル（`note/api.ts`, `review/api.ts`, `search/api.ts`, `subject/api.ts`, `topic/api.ts`）は `.parse(json)` を正しく使用している。この1箇所のみ漏れ。

---

### 5-2. [Medium] usecase 内のローカル Response 型

**規約**: Response 型は `@cpa-study/shared/schemas` から import。

全 usecase.ts をチェックした結果、`^(export )?type.*Response\s*=` にマッチするローカル定義はゼロ。✅ 準拠。

ただし、`subject/usecase.ts` の `SubjectWithStats` はレスポンスに含まれる型であり、shared に定義があるべき。

---

## 6. アーキテクチャの一貫性

### 6-1. [High] study-domain/route.ts で CSV インポート時に Repository を直接生成

**ファイル**: `study-domain/route.ts:102-103`

```ts
const subjectRepo = createSubjectRepository(db)
const txRunner = createNoTransactionRunner(db)
```

**問題**: route ハンドラ内でリポジトリを直接生成している。これはルート初期化時に `deps` として構築すべき。また `bulkImportCSVToStudyDomain` は `tree-usecase` から直接 import しており、study-domain feature から subject feature の usecase を直接呼び出している（feature 間の依存が明示的でない）。

---

### 6-2. [Medium] chat/route.ts の質問評価で2段階 UseCase 呼び出し

**ファイル**: `chat/route.ts:158-179`

```ts
const result = await getMessageForEvaluation({ chatRepo }, user.id, messageId)
if (!result.ok) {
  return errorResponse(c, result.error)
}
const evalResult = await evaluateQuestion(
  { chatRepo, learningRepo, aiAdapter, aiConfig },
  messageId,
  result.value
)
```

**問題**: route 層で2つの usecase を連続呼び出しし、1つ目の結果で分岐している。これは「メッセージ取得 → 評価」という一連のビジネスロジックであり、1つの usecase に統合すべき。

---

## 7. 一貫性マトリクス

### route.ts の handleResult 使用状況

| Feature | handleResult | handleResultWith | errorResponse | c.json 直接 |
|---------|-------------|-----------------|---------------|-------------|
| auth | ✅ | - | - | ✅ (4箇所) |
| bookmark | ✅ | ✅ | - | ✅ (1箇所) |
| chat | - | ✅ | ✅ (1箇所) | - |
| exercise | ✅ | ✅ | - | - |
| image | ✅ | ✅ | - | ✅ (2箇所) |
| learning | - | ✅ | - | - |
| metrics | - | ✅ | - | - |
| note | - | ✅ | - | - |
| study-domain | ✅ | ✅ | - | ✅ (1箇所) |
| subject | ✅ | ✅ | - | ✅ (1箇所) |
| view | ✅ | - | - | - |

### usecase.ts の Result 返却状況

| Feature | 全関数 Result 返却 | 備考 |
|---------|-------------------|------|
| auth | ✅ | |
| bookmark | ✅ | |
| chat | ⚠️ | `sendMessage`, `sendMessageWithNewSession` は AsyncIterable を返す（ストリーミング） |
| exercise | ✅ | |
| image | ❌ | `createUploadUrl` が plain object を返す |
| learning | ✅ | |
| metrics | ✅ | |
| note | ✅ | |
| study-domain | ✅ | |
| subject | ✅ | |
| view | ✅ | |

---

## 修正優先度

### High（修正必須）: 7件

1. `chat/route.ts` — `errorResponse` → `handleResult` に変更
2. `study-domain/route.ts:88`, `subject/route.ts:113` — `c.json({ success: true })` → `handleResult(c, result, 204)` に統一
3. `image/route.ts:73` — `c.json({ success: true })` → `handleResult` 経由に変更
4. `image/usecase.ts:createUploadUrl` — `Result<T, AppError>` を返すように変更
5. `exercises/index.tsx:47` — `as Promise<T>` → Zod parse に変更
6. `study-domain/route.ts:102` — ルート初期化時に deps を構築
7. `auth/usecase.ts` + `auth/route.ts` — `hashToken` を共通ユーティリティに抽出（High ではなく Medium でも可）

### Medium（できれば修正）: 12件

1. chat/exercise/note/image/auth — DI をインラインではなく `deps` 変数に
2. `note/usecase.ts:266, 375` — 非 null アサーション (`!`) を除去
3. `metrics/route.ts:54` — ローカル Zod スキーマを shared に移動
4. exercise/image の画像バリデーションを共通化
5. `chat/route.ts:158-179` — 2段階 usecase を1つに統合
6. auth/exercise/image/study-domain — Deps 型を export
7. `subject/usecase.ts` — ローカル型を shared に移動検討
8. `learning/usecase.ts:164` — inline deps 型を統一
9. DB 操作の try-catch 方針を明確化
10. LLM パース用ローカルスキーマの許容ルールを明文化
11. route.ts と usecase.ts の同名 Deps 型を整理
12. `bookmark/route.ts:37-42` — `handleResultWith` でラップ

### Low（任意）: 3件

1. `exercise/route.ts:110` — `(data) => data` を `handleResult` に
2. `auth` の `hashToken` 重複排除
3. `auth/usecase.ts` の `AuthRepoDeps` 命名
