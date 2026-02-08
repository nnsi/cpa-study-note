import { useEffect, useRef, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { SearchInput } from "./SearchInput"
import { SearchResultItem } from "./SearchResultItem"
import { useGlobalSearch, useSearchNavigation } from "../hooks"
import { getTopicUrl } from "../logic"
import type { TopicSearchResult } from "../api"

type Props = {
  isOpen: boolean
  query: string
  setQuery: (query: string) => void
  onClose: () => void
}

export const GlobalSearchModal = ({ isOpen, query, setQuery, onClose }: Props) => {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const { results, total, isLoading } = useGlobalSearch(query)

  const handleSelect = useCallback(
    (result: TopicSearchResult) => {
      onClose()
      navigate({ to: getTopicUrl(result) })
    },
    [navigate, onClose]
  )

  const { selectedIndex, setSelectedIndex, handleKeyDown } = useSearchNavigation(
    results,
    handleSelect
  )

  // モーダルが開いたら入力にフォーカス
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // 選択されたアイテムをスクロールして表示
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const el = resultsRef.current.children[selectedIndex]
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: "nearest" })
      }
    }
  }, [selectedIndex, results.length])

  // Escapeキーでモーダルを閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 animate-fade-in
                 flex items-start justify-center pt-[10vh] lg:pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* モーダル本体 */}
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up
                   flex flex-col max-h-[70vh] lg:max-h-[60vh]"
        onClick={(e) => e.stopPropagation()}
      >
          {/* 検索入力 */}
          <div className="p-4 border-b border-ink-100">
            <SearchInput
              ref={inputRef}
              value={query}
              onChange={setQuery}
              onKeyDown={handleKeyDown}
              placeholder="論点名を検索..."
            />
            <div className="flex items-center gap-4 mt-2 text-xs text-ink-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-ink-100 rounded text-ink-600">↑↓</kbd>
                移動
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-ink-100 rounded text-ink-600">Enter</kbd>
                選択
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-ink-100 rounded text-ink-600">Esc</kbd>
                閉じる
              </span>
            </div>
          </div>

          {/* 検索結果 */}
          <div className="flex-1 overflow-y-auto" ref={resultsRef}>
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-ink-500 mt-2">検索中...</p>
              </div>
            ) : query.length === 0 ? (
              <div className="p-8 text-center text-ink-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-ink-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                  />
                </svg>
                <p className="text-sm">論点名を入力して検索</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-ink-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-ink-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
                <p className="text-sm">「{query}」に一致する論点が見つかりません</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-100">
                {results.map((result, index) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    query={query}
                    isSelected={index === selectedIndex}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* フッター */}
          {results.length > 0 && (
            <div className="p-3 border-t border-ink-100 bg-ink-50 text-xs text-ink-500 text-center">
              {total}件の結果
            </div>
          )}
        </div>
    </div>
  )
}
