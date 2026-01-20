import { createFileRoute, Link } from "@tanstack/react-router"
import { useAuthStore } from "@/lib/auth"
import { ProgressStats } from "@/features/progress"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            公認会計士試験
            <br />
            AI学習サポート
          </h1>
          <p className="text-gray-600 mb-8">
            AIとの対話で、論点ごとの理解を深めましょう。
            質問の質を高め、効率的な学習を実現します。
          </p>
          <Link to="/login" className="btn-primary inline-block">
            はじめる
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          こんにちは、{user?.displayName || "ユーザー"}さん
        </h1>
        <p className="text-gray-600">今日も学習を頑張りましょう</p>
      </div>

      {/* クイックアクセス */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          to="/subjects"
          className="card hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl group-hover:scale-110 transition-transform">
              📚
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">論点マップ</h2>
              <p className="text-sm text-gray-600">科目・論点を選んで学習</p>
            </div>
          </div>
        </Link>

        <Link
          to="/notes"
          className="card hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl group-hover:scale-110 transition-transform">
              📝
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">ノート</h2>
              <p className="text-sm text-gray-600">学習の記録を確認</p>
            </div>
          </div>
        </Link>
      </div>

      {/* 学習進捗 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">学習進捗</h2>
        <ProgressStats />
      </div>
    </div>
  )
}
