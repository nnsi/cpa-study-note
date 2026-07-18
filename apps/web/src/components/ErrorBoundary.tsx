import { Component, ErrorInfo, ReactNode } from "react"

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 開発環境でのみログ出力（本番ではエラー監視サービスに送信すべき）
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary caught an error:", error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
          <div className="text-center max-w-md">
            <span className="text-6xl mb-4 block">😢</span>
            <h2 className="text-xl font-bold text-ink-900 mb-2">
              エラーが発生しました
            </h2>
            <p className="text-ink-600 mb-4">
              予期しないエラーが発生しました。ページを再読み込みしてください。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              再読み込み
            </button>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 p-4 bg-red-50 text-red-600 text-xs text-left rounded overflow-auto max-h-40">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
