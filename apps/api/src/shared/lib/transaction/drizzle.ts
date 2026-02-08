import type { Db } from "@cpa-study/db"
import type { TransactionRunner, TransactionalRepository, SimpleTransactionRunner } from "./types"

/**
 * トランザクションランナーの選択ガイド
 *
 * | 環境 | 推奨Runner | 理由 |
 * |------|------------|------|
 * | SQLite (ローカル/テスト) | createSimpleTransactionRunner | ネイティブトランザクション利用可能 |
 * | D1 (本番/Staging) | createNoTransactionRunner | D1はBEGIN/COMMITをサポートしない |
 * | Repository pattern使用時 | createDrizzleTransactionRunner | withTx()で複数リポジトリを統合 |
 *
 * D1でのトランザクション的な処理:
 * - 単一テーブルへの複数操作: db.batch() を使用
 * - 複数テーブルへの操作: createNoTransactionRunner で順次実行（原子性なし）
 * - 原子性が必要な場合: アプリケーションレベルで補償トランザクションを実装
 */

/**
 * Creates a TransactionRunner using Drizzle's transaction API
 *
 * Works with:
 * - SQLite (better-sqlite3) - uses native transactions
 * - PostgreSQL, MySQL - uses native transactions
 *
 * Note: D1では内部的にbatch操作にフォールバックするが、
 * 明示的にcreateNoTransactionRunnerを使う方が意図が明確
 */
export const createDrizzleTransactionRunner = (db: Db): TransactionRunner => ({
  async run<T, R extends TransactionalRepository[]>(
    repositories: R,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operation: (txRepos: any) => Promise<T>
  ): Promise<T> {
    return db.transaction(async (tx) => {
      // Create transactional versions of all repositories
      const txRepoArray = repositories.map((repo) => repo.withTx(tx as unknown as Db))
      // Merge all repositories into a single object
      const mergedTxRepos = Object.assign({}, ...txRepoArray)
      return operation(mergedTxRepos)
    })
  },
})

/**
 * Creates a SimpleTransactionRunner using Drizzle's transaction API
 *
 * For simpler use cases where you just need to wrap operations in a transaction
 * without the repository pattern.
 *
 * 使用場面:
 * - SQLiteでのテスト時
 * - PostgreSQL/MySQL環境
 *
 * 注意: D1では使用不可。D1環境では createNoTransactionRunner を使用すること。
 */
export const createSimpleTransactionRunner = (db: Db): SimpleTransactionRunner => ({
  async run<T>(operation: (tx: Db) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      return operation(tx as unknown as Db)
    })
  },
})

/**
 * Creates a SimpleTransactionRunner that executes without transaction wrapping
 *
 * 使用場面:
 * - D1環境（本番/Staging）
 * - トランザクションが不要な単純な操作
 *
 * 注意:
 * - 操作は順次実行され、原子性は保証されない
 * - 途中で失敗した場合、それまでの操作はロールバックされない
 * - 原子性が必要な場合は、db.batch() または補償トランザクションを検討
 */
export const createNoTransactionRunner = (db: Db): SimpleTransactionRunner => ({
  async run<T>(operation: (tx: Db) => Promise<T>): Promise<T> {
    return operation(db)
  },
})
