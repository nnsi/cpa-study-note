import { ReactNode } from "react"

type Props = {
  children: ReactNode
  /** フルワイドページの場合 true（パディングなし） */
  fullWidth?: boolean
}

/**
 * ページコンテンツのラッパー
 * - 通常ページ: max-width + パディング適用
 * - フルワイドページ: ラッパーなし（チャットページなど）
 */
export const PageWrapper = ({ children, fullWidth = false }: Props) => {
  if (fullWidth) {
    return <>{children}</>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      {children}
    </div>
  )
}
