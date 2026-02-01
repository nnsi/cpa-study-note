import type { BookmarkTargetType } from "../api"
import { useIsBookmarked, useToggleBookmark } from "../hooks"

type Props = {
  targetType: BookmarkTargetType
  targetId: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
}

const iconSizeClasses = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
}

export const BookmarkButton = ({
  targetType,
  targetId,
  size = "md",
  className = "",
}: Props) => {
  const { isBookmarked, isLoading: isLoadingStatus } = useIsBookmarked(targetType, targetId)
  const { toggle, isLoading: isToggling } = useToggleBookmark()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(targetType, targetId, isBookmarked)
  }

  const isLoading = isLoadingStatus || isToggling

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        ${sizeClasses[size]}
        flex items-center justify-center
        rounded-lg
        transition-all duration-200
        ${isBookmarked
          ? "bg-amber-100 text-amber-500 hover:bg-amber-200"
          : "bg-ink-50 text-ink-400 hover:bg-ink-100 hover:text-amber-500"
        }
        ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
      title={isBookmarked ? "ブックマークを解除" : "ブックマークに追加"}
      aria-label={isBookmarked ? "ブックマークを解除" : "ブックマークに追加"}
    >
      {isLoading ? (
        <svg
          className={`${iconSizeClasses[size]} animate-spin`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        <svg
          className={iconSizeClasses[size]}
          fill={isBookmarked ? "currentColor" : "none"}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
      )}
    </button>
  )
}
