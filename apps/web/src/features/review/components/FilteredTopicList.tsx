import { Link } from "@tanstack/react-router"
import type { FilteredTopic } from "../api"
import { formatLastChatDate, summarizeFilters } from "../logic"
import type { TopicFilterParams } from "../api"

type FilteredTopicListProps = {
  topics: FilteredTopic[]
  groupedTopics: Map<string, { subjectName: string; topics: FilteredTopic[] }>
  filters: TopicFilterParams
  hasFilters: boolean
  isLoading: boolean
  isError: boolean
}

export const FilteredTopicList = ({
  topics,
  groupedTopics,
  filters,
  hasFilters,
  isLoading,
  isError,
}: FilteredTopicListProps) => {
  if (!hasFilters) {
    return (
      <div className="card p-8 text-center">
        <div className="text-ink-400 mb-4">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-ink-700 mb-2">
          条件を選択してください
        </h3>
        <p className="text-sm text-ink-500">
          左のフィルタで条件を指定し、「検索」ボタンを押してください
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="h-5 skeleton rounded w-1/4 mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-16 skeleton rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <div className="text-red-400 mb-4">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-ink-700 mb-2">
          エラーが発生しました
        </h3>
        <p className="text-sm text-ink-500">
          データの取得に失敗しました。再度お試しください。
        </p>
      </div>
    )
  }

  const filterSummary = summarizeFilters(filters)

  if (topics.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-ink-400 mb-4">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-ink-700 mb-2">
          該当する論点がありません
        </h3>
        {filterSummary.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-3">
            {filterSummary.map((s, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs bg-ink-100 text-ink-600 rounded"
              >
                {s}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-ink-500">
          フィルタ条件を変更してお試しください
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 結果サマリー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-ink-900">
            {topics.length}件の論点
          </span>
          {filterSummary.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filterSummary.map((s, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 科目別リスト */}
      {Array.from(groupedTopics.entries()).map(
        ([subjectId, { subjectName, topics }]) => (
          <div key={subjectId} className="card overflow-hidden">
            <div className="px-5 py-3 bg-ink-50 border-b border-ink-100">
              <h3 className="font-semibold text-ink-800">
                {subjectName}
                <span className="ml-2 text-sm font-normal text-ink-500">
                  ({topics.length}件)
                </span>
              </h3>
            </div>
            <div className="divide-y divide-ink-100">
              {topics.map((topic) => (
                <TopicListItem key={topic.id} topic={topic} />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

type TopicListItemProps = {
  topic: FilteredTopic
}

const TopicListItem = ({ topic }: TopicListItemProps) => {
  return (
    <Link
      to="/subjects/$subjectId/$categoryId/$topicId"
      params={{
        subjectId: topic.subjectId,
        categoryId: topic.categoryId,
        topicId: topic.id,
      }}
      className="flex items-center gap-4 px-5 py-4 hover:bg-ink-50 transition-colors group"
    >
      {/* チェック状態インジケーター */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          topic.understood
            ? "bg-jade-100 text-jade-600"
            : "bg-ink-100 text-ink-400"
        }`}
      >
        {topic.understood ? (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m4.5 12.75 6 6 9-13.5"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        )}
      </div>

      {/* 論点情報 */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-ink-900 group-hover:text-indigo-600 transition-colors truncate">
          {topic.name}
        </h4>
        <div className="flex items-center gap-4 mt-1 text-sm text-ink-500">
          <span className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
              />
            </svg>
            {topic.sessionCount}セッション
          </span>
          <span className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            {formatLastChatDate(topic.lastChatAt)}
          </span>
          {topic.goodQuestionCount > 0 && (
            <span className="flex items-center gap-1 text-jade-600">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
              良質{topic.goodQuestionCount}件
            </span>
          )}
        </div>
      </div>

      {/* 矢印 */}
      <div className="text-ink-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all duration-300 flex-shrink-0">
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m8.25 4.5 7.5 7.5-7.5 7.5"
          />
        </svg>
      </div>
    </Link>
  )
}
