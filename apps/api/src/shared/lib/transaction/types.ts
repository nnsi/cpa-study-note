import type { Db } from "@cpa-study/db"

/**
 * Repository interface with transaction support
 * Each repository must implement withTx to create a transactional version
 */
export type TransactionalRepository = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withTx: (tx: Db) => any
}

/**
 * TransactionRunner - Abstraction for database transactions
 *
 * Allows running operations across multiple repositories within a single transaction.
 * The implementation can be swapped between Drizzle transaction, D1 batch, or mock for testing.
 */
export type TransactionRunner = {
  /**
   * Run an operation within a transaction
   * @param repositories - Array of repositories to use in the transaction
   * @param operation - Function that performs the transactional operations
   * @returns Promise resolving to the operation result
   */
  run<T, R extends TransactionalRepository[]>(
    repositories: R,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operation: (txRepos: any) => Promise<T>
  ): Promise<T>
}

/**
 * Simple transaction runner that just wraps db.transaction()
 * For use cases where repositories are not needed (e.g., tree operations)
 */
export type SimpleTransactionRunner = {
  /**
   * Run an operation within a transaction
   * @param operation - Function that receives the transactional db instance
   * @returns Promise resolving to the operation result
   */
  run<T>(operation: (tx: Db) => Promise<T>): Promise<T>
}
