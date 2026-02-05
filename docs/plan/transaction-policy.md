# トランザクション方針

このドキュメントでは、Cloudflare D1環境におけるトランザクション処理の制約と、本プロジェクトでの対応方針を説明します。

---

## 1. D1の制約

### 1.1 SQLトランザクションが使用不可

Cloudflare D1は**SQLレベルのトランザクション（BEGIN/COMMIT/ROLLBACK）をサポートしていません**。

```sql
-- D1ではエラーになる
BEGIN TRANSACTION;
INSERT INTO categories ...;
INSERT INTO topics ...;
COMMIT;
```

Drizzle ORMの `db.transaction()` を使用しても、内部的にはネイティブトランザクションにはならず、D1独自の挙動にフォールバックします。

### 1.2 `db.batch()` による原子性確保

D1は `db.batch()` による**複数クエリの原子的実行**をサポートしています。

```typescript
// D1のbatch: 全て成功 or 全て失敗
await db.batch([
  db.insert(categories).values({ id: catId, name: "単元A" }),
  db.insert(topics).values({ id: topicId, categoryId: catId, name: "論点1" }),
])
```

ただし、`db.batch()` には制限があります:
- 事前に全クエリを配列で構築する必要がある
- 中間結果を使った条件分岐ができない
- 複雑なビジネスロジックには不向き

---

## 2. TransactionRunnerの種類

プロジェクトでは、環境やユースケースに応じて3種類のRunnerを提供しています。

### 2.1 一覧

| Runner | 用途 | 原子性 |
|--------|------|--------|
| `createSimpleTransactionRunner` | SQLite（ローカル/テスト） | あり |
| `createNoTransactionRunner` | D1環境（本番/Staging） | なし |
| `createDrizzleTransactionRunner` | Repository pattern使用時 | 環境依存 |

### 2.2 `createSimpleTransactionRunner`

SQLiteのネイティブトランザクションを利用します。

```typescript
import { createSimpleTransactionRunner } from "@/shared/lib/transaction"

const txRunner = createSimpleTransactionRunner(db)

await txRunner.run(async (tx) => {
  await tx.insert(categories).values({ ... })
  await tx.insert(topics).values({ ... })
  // 途中でエラーが発生すると全てロールバック
})
```

**使用場面**:
- ローカル開発（SQLite）
- 単体テスト
- PostgreSQL/MySQL環境

**注意**: D1では使用不可。実行時エラーになります。

### 2.3 `createNoTransactionRunner`

トランザクションラッパーなしで操作を順次実行します。

```typescript
import { createNoTransactionRunner } from "@/shared/lib/transaction"

const txRunner = createNoTransactionRunner(db)

await txRunner.run(async (tx) => {
  await tx.insert(categories).values({ ... })
  await tx.insert(topics).values({ ... })
  // 途中でエラーが発生しても、先の操作はロールバックされない
})
```

**使用場面**:
- D1環境（本番/Staging）
- トランザクションが不要な単純な操作

**注意**:
- 操作は順次実行され、**原子性は保証されない**
- 途中で失敗した場合、それまでの操作は**ロールバックされない**

### 2.4 `createDrizzleTransactionRunner`

Repository patternと組み合わせて使用します。複数のリポジトリを跨いだトランザクションに対応。

```typescript
import { createDrizzleTransactionRunner } from "@/shared/lib/transaction"

const txRunner = createDrizzleTransactionRunner(db)

await txRunner.run([chatRepo, topicRepo], async ({ chatRepo, topicRepo }) => {
  await topicRepo.updateAccessedAt(topicId)
  await chatRepo.createMessage({ ... })
})
```

**使用場面**:
- 複数リポジトリを跨いだ操作
- Repository patternを採用している機能

---

## 3. 使用ガイドライン

### 3.1 環境別の選択フロー

```
本番/Staging (D1)?
  ├─ Yes → createNoTransactionRunner
  │         └─ 原子性が必要? → db.batch() or 補償トランザクション
  │
  └─ No (SQLite/ローカル/テスト)
       └─ Repository pattern?
            ├─ Yes → createDrizzleTransactionRunner
            └─ No  → createSimpleTransactionRunner
```

### 3.2 Route層でのDI

ルート定義時に環境に応じたRunnerを注入します。

```typescript
// apps/api/src/features/subject/route.ts
type SubjectDeps = {
  env: Env
  db: Db
  txRunner?: SimpleTransactionRunner  // 省略可能
}

export const subjectRoutes = ({ db, txRunner }: SubjectDeps) => {
  const treeDeps = { subjectRepo, db, txRunner }
  // ...
}
```

### 3.3 UseCase層での利用

UseCaseでは、渡されたRunnerを使用し、フォールバックも用意します。

```typescript
// apps/api/src/features/subject/usecase.ts
export type TreeUseCaseDeps = {
  subjectRepo: SubjectRepository
  db: Db
  txRunner?: SimpleTransactionRunner
}

export const updateSubjectTree = async (
  deps: TreeUseCaseDeps,
  userId: string,
  subjectId: string,
  tree: UpdateTreeRequest
): Promise<Result<void, AppError>> => {
  // txRunnerがない場合はdb.transactionを直接使用（フォールバック）
  const runInTransaction = deps.txRunner
    ? deps.txRunner.run.bind(deps.txRunner)
    : (fn: (tx: Db) => Promise<void>) => (deps.db as any).transaction(fn)

  await runInTransaction(async (tx: Db) => {
    // 複数の操作を実行
    await txRepo.softDeleteCategories(categoriesToDelete, now)
    await txRepo.softDeleteTopics(topicsToDelete, now)
    await txRepo.upsertCategory({ ... })
    await txRepo.upsertTopic({ ... })
  })

  return ok(undefined)
}
```

---

## 4. 複雑な操作での注意点

### 4.1 `updateSubjectTree` のケース

ツリー更新は複数テーブルへの操作を含む典型例です。

**操作内容**:
1. 既存カテゴリ/論点の論理削除
2. カテゴリのupsert（insert or update）
3. 論点のupsert

**D1環境での挙動**:
- `createNoTransactionRunner` を使用
- 操作は順次実行される
- 途中で失敗すると、データが不整合な状態になる可能性がある

**リスク軽減策**:
1. **バリデーションを先に行う**: IDの存在確認等を操作前に完了させる
2. **冪等性を確保**: 同じリクエストを複数回実行しても結果が同じになるよう設計
3. **論理削除**: 物理削除しないことで、障害時の復旧が容易

### 4.2 原子性が必須の場合

`db.batch()` を直接使用するか、アプリケーションレベルで補償トランザクションを実装します。

```typescript
// db.batch() の例
const queries = [
  db.update(categories).set({ deletedAt: now }).where(eq(categories.id, catId)),
  db.insert(categories).values(newCategory),
]
await db.batch(queries)
```

**補償トランザクションの例**:
```typescript
try {
  await step1()
  await step2()
  await step3()
} catch (error) {
  // step1, step2の結果を手動で戻す
  await rollbackStep1()
  await rollbackStep2()
  throw error
}
```

---

## 5. テスト時の考慮事項

### 5.1 Mock Runnerの使用

テストでは `createMockSimpleTransactionRunner` を使用することで、実際のトランザクション挙動に依存しないテストが可能です。

```typescript
import { createMockSimpleTransactionRunner } from "@/shared/lib/transaction"

const mockTxRunner = createMockSimpleTransactionRunner(db)
const deps = { subjectRepo, db, txRunner: mockTxRunner }
```

### 5.2 統合テストでの注意

SQLite環境（ローカル）とD1環境（本番）でトランザクション挙動が異なるため、以下に注意:

- SQLiteでの成功 ≠ D1での成功
- 原子性に依存したテストは、D1環境でも検証が必要
- CIではD1エミュレーターまたは実D1環境でのテストを推奨

---

## 6. 参照

- 実装: `apps/api/src/shared/lib/transaction/`
  - `types.ts`: 型定義
  - `drizzle.ts`: Runner実装
  - `mock.ts`: テスト用Mock
- 使用例: `apps/api/src/features/subject/usecase.ts`
- Cloudflare D1ドキュメント: [D1 batch operations](https://developers.cloudflare.com/d1/platform/client-api/#batch-statements)
