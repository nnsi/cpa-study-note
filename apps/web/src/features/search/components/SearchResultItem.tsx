import type { TopicSearchResult } from "../api"
import { highlightMatch } from "../logic"

type Props = {
  result: TopicSearchResult
  query: string
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
}

export const SearchResultItem = ({
  result,
  query,
  isSelected,
  onClick,
  onMouseEnter,
}: Props) => {
  const nameHighlighted = highlightMatch(result.name, query)

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        w-full text-left px-4 py-3 transition-colors
        ${isSelected
          ? "bg-indigo-50 text-indigo-900"
          : "hover:bg-ink-50 text-ink-800"
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* アイコン */}
        <div
          className={`
            w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5
            ${isSelected ? "bg-indigo-100 text-indigo-600" : "bg-ink-100 text-ink-500"}
          `}
        >
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
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
            />
          </svg>
        </div>

        {/* テキスト */}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {nameHighlighted.map((part, i) =>
              part.highlight ? (
                <mark
                  key={i}
                  className="bg-amber-200 text-amber-900 rounded px-0.5"
                >
                  {part.text}
                </mark>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </div>
          <div className="text-sm text-ink-500 truncate mt-0.5">
            {result.subjectName} &gt; {result.categoryName}
          </div>
          {result.description && (
            <div className="text-xs text-ink-400 truncate mt-1">
              {result.description}
            </div>
          )}
        </div>

        {/* 矢印 */}
        <div
          className={`
            shrink-0 mt-1
            ${isSelected ? "text-indigo-500" : "text-ink-300"}
          `}
        >
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
              d="m8.25 4.5 7.5 7.5-7.5 7.5"
            />
          </svg>
        </div>
      </div>
    </button>
  )
}
