import type { Db } from "@cpa-study/db"
import type { BatchItem } from "drizzle-orm/batch"

/**
 * db.batch() で原子的に実行できる書き込みステートメント。
 * drizzleのクエリビルダ（例: `db.insert(table).values(...)`）がこれに該当する。
 * await せずに builder のまま渡すこと（await すると即時実行され batch に載らない）。
 */
export type BatchStatement = BatchItem<"sqlite">

type BatchCapableDb = {
  batch(statements: [BatchStatement, ...BatchStatement[]]): Promise<unknown>
}

// D1ドライバは batch() を持つが、テストの better-sqlite3 ドライバは持たない。
// 抽象 Db 型には batch() が無いため、実行時に存在検出して型を絞り込む。
const hasBatch = (db: Db): db is Db & BatchCapableDb =>
  typeof (db as { batch?: unknown }).batch === "function"

/**
 * 複数の書き込みを可能な限り原子的に実行する。
 *
 * - D1（本番/Staging）: `db.batch()` により単一トランザクション相当で原子実行。
 *   途中失敗時は全てロールバックされ、部分的な書き込みによる不整合が残らない。
 * - better-sqlite3（テスト）: batch非対応のため順次 await にフォールバックする。
 *   原子性は無いが、テストは途中失敗時の原子性シナリオを検証しないため実害はない。
 *
 * drizzleのクエリビルダは thenable なので、フォールバックでは個別に await して実行する。
 */
export const runBatch = async (db: Db, statements: BatchStatement[]): Promise<void> => {
  if (statements.length === 0) return

  if (hasBatch(db)) {
    // 非空であることは上でチェック済み。D1の batch() は非空タプルを要求する。
    const [first, ...rest] = statements
    await db.batch([first, ...rest])
    return
  }

  // フォールバック（テスト等）: 順次実行
  for (const statement of statements) {
    await statement
  }
}
