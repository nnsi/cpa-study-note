import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { useProgress } from "./hooks"

// APIモジュールをモック
vi.mock("./api", () => ({
  getMyProgress: vi.fn(),
  getSubjectProgressStats: vi.fn(),
}))

import * as api from "./api"

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

const createWrapper = () => {
  const queryClient = createTestQueryClient()
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// progressデータのモック作成ヘルパー
const createProgressItem = (
  overrides: Partial<{
    userId: string
    topicId: string
    understood: boolean
    lastAccessedAt: string | null
    createdAt: string
    updatedAt: string
  }> = {}
) => ({
  userId: "user-1",
  topicId: "topic-1",
  understood: false,
  lastAccessedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe("useProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("完了率計算", () => {
    it("正しく完了率を計算する", async () => {
      vi.mocked(api.getMyProgress).mockResolvedValue({
        progress: [
          createProgressItem({
            topicId: "topic-1",
            understood: true,
            lastAccessedAt: new Date().toISOString(),
          }),
          createProgressItem({ topicId: "topic-2", understood: false }),
        ],
      })
      vi.mocked(api.getSubjectProgressStats).mockResolvedValue({
        stats: [
          {
            subjectId: "subject-1",
            subjectName: "財務会計論",
            totalTopics: 10,
            understoodTopics: 6,
          },
          {
            subjectId: "subject-2",
            subjectName: "管理会計論",
            totalTopics: 10,
            understoodTopics: 4,
          },
        ],
      })

      const { result } = renderHook(() => useProgress(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // 合計20トピック中10完了 = 50%
      expect(result.current.stats.totalTopics).toBe(20)
      expect(result.current.stats.understoodTopics).toBe(10)
      expect(result.current.stats.completionRate).toBe(50)
    })

    it("トピックがない場合は完了率0%", async () => {
      vi.mocked(api.getMyProgress).mockResolvedValue({
        progress: [],
      })
      vi.mocked(api.getSubjectProgressStats).mockResolvedValue({
        stats: [],
      })

      const { result } = renderHook(() => useProgress(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.stats.totalTopics).toBe(0)
      expect(result.current.stats.understoodTopics).toBe(0)
      expect(result.current.stats.completionRate).toBe(0)
    })

    it("全て完了している場合は100%", async () => {
      vi.mocked(api.getMyProgress).mockResolvedValue({
        progress: [
          createProgressItem({
            understood: true,
            lastAccessedAt: new Date().toISOString(),
          }),
        ],
      })
      vi.mocked(api.getSubjectProgressStats).mockResolvedValue({
        stats: [
          {
            subjectId: "subject-1",
            subjectName: "財務会計論",
            totalTopics: 5,
            understoodTopics: 5,
          },
        ],
      })

      const { result } = renderHook(() => useProgress(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.stats.completionRate).toBe(100)
    })

    it("完了率は四捨五入される", async () => {
      vi.mocked(api.getMyProgress).mockResolvedValue({
        progress: [],
      })
      vi.mocked(api.getSubjectProgressStats).mockResolvedValue({
        stats: [
          {
            subjectId: "subject-1",
            subjectName: "財務会計論",
            totalTopics: 3,
            understoodTopics: 1, // 33.33...%
          },
        ],
      })

      const { result } = renderHook(() => useProgress(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // 1/3 = 33.33...% → 33% (Math.round)
      expect(result.current.stats.completionRate).toBe(33)
    })
  })

  describe("科目別集計", () => {
    it("科目ごとの進捗を返す", async () => {
      vi.mocked(api.getMyProgress).mockResolvedValue({
        progress: [],
      })
      vi.mocked(api.getSubjectProgressStats).mockResolvedValue({
        stats: [
          {
            subjectId: "subject-1",
            subjectName: "財務会計論",
            totalTopics: 15,
            understoodTopics: 10,
          },
          {
            subjectId: "subject-2",
            subjectName: "管理会計論",
            totalTopics: 12,
            understoodTopics: 8,
          },
          {
            subjectId: "subject-3",
            subjectName: "監査論",
            totalTopics: 8,
            understoodTopics: 3,
          },
        ],
      })

      const { result } = renderHook(() => useProgress(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.subjectProgress).toHaveLength(3)
      expect(result.current.subjectProgress).toEqual([
        {
          id: "subject-1",
          name: "財務会計論",
          totalTopics: 15,
          understoodTopics: 10,
        },
        {
          id: "subject-2",
          name: "管理会計論",
          totalTopics: 12,
          understoodTopics: 8,
        },
        {
          id: "subject-3",
          name: "監査論",
          totalTopics: 8,
          understoodTopics: 3,
        },
      ])
    })

    it("科目がない場合は空配列", async () => {
      vi.mocked(api.getMyProgress).mockResolvedValue({
        progress: [],
      })
      vi.mocked(api.getSubjectProgressStats).mockResolvedValue({
        stats: [],
      })

      const { result } = renderHook(() => useProgress(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.subjectProgress).toEqual([])
    })
  })

  describe("最近アクセスしたトピックのカウント", () => {
    it("1週間以内にアクセスしたトピックをカウント", async () => {
      const now = new Date()
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)

      vi.mocked(api.getMyProgress).mockResolvedValue({
        progress: [
          createProgressItem({
            topicId: "topic-1",
            understood: true,
            lastAccessedAt: now.toISOString(),
          }),
          createProgressItem({
            topicId: "topic-2",
            understood: true,
            lastAccessedAt: threeDaysAgo.toISOString(),
          }),
          createProgressItem({
            topicId: "topic-3",
            understood: false,
            lastAccessedAt: tenDaysAgo.toISOString(),
          }), // 1週間以上前
          createProgressItem({
            topicId: "topic-4",
            understood: false,
          }), // 未アクセス
        ],
      })
      vi.mocked(api.getSubjectProgressStats).mockResolvedValue({
        stats: [],
      })

      const { result } = renderHook(() => useProgress(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // 1週間以内にアクセスしたのは2件
      expect(result.current.stats.recentlyAccessedTopics).toBe(2)
    })

    it("アクセス履歴がない場合は0", async () => {
      vi.mocked(api.getMyProgress).mockResolvedValue({
        progress: [
          createProgressItem({ topicId: "topic-1", understood: false }),
          createProgressItem({ topicId: "topic-2", understood: false }),
        ],
      })
      vi.mocked(api.getSubjectProgressStats).mockResolvedValue({
        stats: [],
      })

      const { result } = renderHook(() => useProgress(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.stats.recentlyAccessedTopics).toBe(0)
    })
  })

  describe("ローディング状態", () => {
    it("両方のAPIがロード中の間はisLoading=true", async () => {
      type ProgressResponse = { progress: ReturnType<typeof createProgressItem>[] }
      type StatsResponse = {
        stats: {
          subjectId: string
          subjectName: string
          totalTopics: number
          understoodTopics: number
        }[]
      }

      let resolveProgress: (value: ProgressResponse) => void
      let resolveStats: (value: StatsResponse) => void

      vi.mocked(api.getMyProgress).mockReturnValue(
        new Promise<ProgressResponse>((resolve) => {
          resolveProgress = resolve
        })
      )
      vi.mocked(api.getSubjectProgressStats).mockReturnValue(
        new Promise<StatsResponse>((resolve) => {
          resolveStats = resolve
        })
      )

      const { result } = renderHook(() => useProgress(), {
        wrapper: createWrapper(),
      })

      // 初期状態はローディング中
      expect(result.current.isLoading).toBe(true)

      // 片方だけ完了
      resolveProgress!({ progress: [] })
      await waitFor(() => {
        // まだstatsがロード中なのでisLoading=true
        expect(result.current.isLoading).toBe(true)
      })

      // 両方完了
      resolveStats!({ stats: [] })
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})
