import { createFileRoute, Link } from "@tanstack/react-router"
import { TopicFilter, FilteredTopicList, useTopicFilter } from "@/features/review"
import { DailyMetricsChart } from "@/features/metrics"
import { requireAuth } from "@/lib/auth"

type ReviewSearch = {
  minSessionCount?: string
  daysSinceLastChat?: string
  understood?: string
  hasPostCheckChat?: string
  minGoodQuestionCount?: string
}

export const Route = createFileRoute("/review")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): ReviewSearch => {
    return {
      minSessionCount:
        typeof search.minSessionCount === "string"
          ? search.minSessionCount
          : undefined,
      daysSinceLastChat:
        typeof search.daysSinceLastChat === "string"
          ? search.daysSinceLastChat
          : undefined,
      understood:
        typeof search.understood === "string" ? search.understood : undefined,
      hasPostCheckChat:
        typeof search.hasPostCheckChat === "string"
          ? search.hasPostCheckChat
          : undefined,
      minGoodQuestionCount:
        typeof search.minGoodQuestionCount === "string"
          ? search.minGoodQuestionCount
          : undefined,
    }
  },
  component: ReviewPage,
})

function ReviewPage() {
  const {
    filters,
    updateFilter,
    resetFilters,
    hasFilters,
    topics,
    groupedTopics,
    isLoading,
    isError,
    applyFilters,
  } = useTopicFilter()

  return (
    <div className="animate-fade-in">
      {/* ヘッダー */}
      <div className="mb-6">
        <nav className="flex items-center gap-2 text-sm text-ink-500 mb-2">
          <Link to="/" className="hover:text-indigo-600">
            ホーム
          </Link>
          <span>/</span>
          <span className="text-ink-900">論点フィルタ</span>
        </nav>
        <h1 className="heading-serif text-2xl lg:text-3xl text-ink-900">
          論点フィルタ
        </h1>
        <p className="text-ink-600 mt-1">
          条件を指定して、復習が必要な論点を抽出します
        </p>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* フィルタパネル */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <TopicFilter
            filters={filters}
            onUpdateFilter={updateFilter}
            onApply={applyFilters}
            onReset={resetFilters}
            isLoading={isLoading}
          />
        </aside>

        {/* 結果表示 */}
        <main className="space-y-6">
          {/* 学習推移グラフ */}
          <section>
            <h2 className="text-lg font-semibold text-ink-800 mb-3">
              学習推移
            </h2>
            <DailyMetricsChart />
          </section>

          {/* フィルタ結果 */}
          <section>
            <FilteredTopicList
              topics={topics}
              groupedTopics={groupedTopics}
              filters={filters}
              hasFilters={hasFilters}
              isLoading={isLoading}
              isError={isError}
            />
          </section>
        </main>
      </div>
    </div>
  )
}
