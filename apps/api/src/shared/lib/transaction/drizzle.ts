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
 */
export const createSimpleTransactionRunner = (db: Db): SimpleTransactionRunner => ({
  async run<T>(operation: (tx: Db) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      return operation(tx as unknown as Db)
    })
  },
})
