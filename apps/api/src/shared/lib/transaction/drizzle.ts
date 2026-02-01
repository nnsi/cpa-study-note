import type { Db } from "@cpa-study/db"
import type { TransactionRunner, TransactionalRepository, SimpleTransactionRunner } from "./types"

/**
 * Creates a TransactionRunner using Drizzle's transaction API
 *
 * Works with:
 * - SQLite (better-sqlite3) - uses native transactions
 * - D1 - uses batch operations internally
 * - PostgreSQL, MySQL - uses native transactions
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
 * NOTE: Does NOT work with D1. Use createNoTransactionRunner for D1.
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
 * Use this for D1, which does not support SQL transactions (BEGIN/COMMIT).
 * Operations are executed sequentially without atomicity guarantees.
 */
export const createNoTransactionRunner = (db: Db): SimpleTransactionRunner => ({
  async run<T>(operation: (tx: Db) => Promise<T>): Promise<T> {
    return operation(db)
  },
})
