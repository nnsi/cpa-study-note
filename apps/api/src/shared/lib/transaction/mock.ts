import type { Db } from "@cpa-study/db"
import type { TransactionRunner, TransactionalRepository, SimpleTransactionRunner } from "./types"

/**
 * Creates a mock TransactionRunner for testing
 *
 * Simply merges repositories and runs the operation without actual transaction.
 * Useful for unit tests where transaction behavior is not being tested.
 */
export const createMockTransactionRunner = (): TransactionRunner => ({
  async run<T, R extends TransactionalRepository[]>(
    repositories: R,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operation: (txRepos: any) => Promise<T>
  ): Promise<T> {
    // Just merge repositories without transaction
    const mergedRepos = Object.assign({}, ...repositories)
    return operation(mergedRepos)
  },
})

/**
 * Creates a mock SimpleTransactionRunner for testing
 *
 * Simply runs the operation with the provided db without actual transaction.
 */
export const createMockSimpleTransactionRunner = (db: Db): SimpleTransactionRunner => ({
  async run<T>(operation: (tx: Db) => Promise<T>): Promise<T> {
    // Just run the operation without transaction
    return operation(db)
  },
})
