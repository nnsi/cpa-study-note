import { useState, useRef, useEffect } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useCurrentDomain } from "../hooks/useCurrentDomain"
import { useStudyDomains } from "../hooks/useStudyDomains"
import { getColorClass } from "@/lib/colorClasses"

/**
 * ヘッダーに表示する学習領域選択ドロップダウン
 */
export function DomainSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { domainId, domain, isLoading: isLoadingCurrent } = useCurrentDomain()
  const { studyDomains, isLoading: isLoadingDomains } = useStudyDomains()

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Escキーでドロップダウンを閉じる
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  const handleDomainSelect = (selectedDomainId: string) => {
    setIsOpen(false)
    navigate({
      to: "/domains/$domainId/subjects",
      params: { domainId: selectedDomainId },
    })
  }

  const isLoading = isLoadingCurrent || isLoadingDomains

  // 現在の学習領域の表示名とアイコン
  const currentDomainName = domain?.name ?? "学習領域を選択"
  const currentDomainEmoji = domain?.emoji ?? "📚"
  const currentDomainColor = domain?.color ?? null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* トリガーボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-ink-50 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="size-6 skeleton rounded" />
            <div className="w-20 h-4 skeleton rounded" />
          </div>
        ) : (
          <>
            <span
              className={`size-6 rounded-md ${getColorClass(currentDomainColor)} flex items-center justify-center text-sm`}
            >
              {currentDomainEmoji}
            </span>
            <span className="text-sm font-medium text-ink-700 max-w-32 truncate">
              {currentDomainName}
            </span>
            <svg
              className={`size-4 text-ink-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </>
        )}
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-soft border border-ink-100 py-2 z-50 animate-fade-in">
          {/* 学習領域一覧 */}
          <div className="px-3 py-2">
            <span className="label text-xs">学習領域</span>
          </div>

          {isLoadingDomains ? (
            <div className="px-3 space-y-1">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-10 skeleton rounded-lg" />
              ))}
            </div>
          ) : studyDomains.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-sm text-ink-400">
                学習領域がありません
              </p>
            </div>
          ) : (
            <ul role="listbox" className="px-1">
              {studyDomains.map((studyDomain) => {
                const isSelected = studyDomain.id === domainId

                return (
                  <li key={studyDomain.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleDomainSelect(studyDomain.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-700"
                          : "hover:bg-ink-50 text-ink-700"
                      }`}
                    >
                      <span
                        className={`size-8 rounded-lg ${getColorClass(studyDomain.color)} flex items-center justify-center`}
                      >
                        {studyDomain.emoji ?? "📚"}
                      </span>
                      <div className="flex-1 text-left min-w-0">
                        <span className="block text-sm font-medium truncate">
                          {studyDomain.name}
                        </span>
                        {studyDomain.description && (
                          <span className="block text-xs text-ink-400 truncate">
                            {studyDomain.description}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <svg
                          className="size-4 text-indigo-500 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {/* 区切り線 */}
          <div className="my-2 divider" />

          {/* 学習領域の管理リンク */}
          <div className="px-1">
            <Link
              to="/domains"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-ink-50 transition-colors text-ink-600"
            >
              <span className="size-8 rounded-lg bg-ink-100 flex items-center justify-center">
                <svg
                  className="size-4 text-ink-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
              <span className="text-sm font-medium">学習領域を管理</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
