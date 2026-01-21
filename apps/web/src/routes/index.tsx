import { createFileRoute, Link } from "@tanstack/react-router"
import { useAuthStore } from "@/lib/auth"
import { ProgressStats } from "@/features/progress"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated()) {
    return <LandingPage />
  }

  return <DashboardPage user={user} />
}

// ランディングページ（未ログイン）
function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-72px)] px-4 -mt-8">
      {/* 装飾的な背景要素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center max-w-lg animate-fade-in-up">
        {/* ロゴマーク */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-soft-lg">
            <span className="text-white font-serif font-bold text-3xl">会</span>
          </div>
        </div>

        {/* メインタイトル */}
        <h1 className="heading-serif text-4xl lg:text-5xl text-ink-900 mb-6 leading-tight">
          公認会計士試験
          <br />
          <span className="text-gradient">AI学習サポート</span>
        </h1>

        {/* サブタイトル */}
        <p className="text-lg text-ink-600 mb-10 leading-relaxed">
          AIとの対話で、論点ごとの理解を深めましょう。
          <br className="hidden sm:block" />
          質問の質を高め、効率的な学習を実現します。
        </p>

        {/* CTA */}
        <Link
          to="/login"
          className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-3"
        >
          <span>はじめる</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>

        {/* 特徴 */}
        <div className="mt-16 grid grid-cols-3 gap-6 text-center">
          {[
            { icon: "📚", label: "体系的な論点整理" },
            { icon: "💬", label: "AI対話で理解深化" },
            { icon: "📝", label: "自動ノート作成" },
          ].map((feature, i) => (
            <div
              key={feature.label}
              className={`animate-fade-in-up animation-delay-${(i + 1) * 100}`}
            >
              <div className="text-3xl mb-2">{feature.icon}</div>
              <div className="text-sm text-ink-500">{feature.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ダッシュボード（ログイン済み）
type User = {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

function DashboardPage({ user }: { user: User | null }) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* 挨拶 */}
      <div className="ornament-line pb-6">
        <h1 className="heading-serif text-2xl lg:text-3xl mb-2">
          こんにちは、{user?.displayName || "ユーザー"}さん
        </h1>
        <p className="text-ink-600">今日も学習を頑張りましょう</p>
      </div>

      {/* クイックアクセス */}
      <div className="grid gap-4 md:grid-cols-2">
        <QuickAccessCard
          to="/subjects"
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          }
          title="論点マップ"
          description="科目・論点を選んで学習"
          accentColor="indigo"
        />

        <QuickAccessCard
          to="/notes"
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          }
          title="ノート"
          description="学習の記録を確認"
          accentColor="amber"
        />
      </div>

      {/* 学習進捗 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="heading-serif text-xl">学習進捗</h2>
          <div className="flex-1 divider" />
        </div>
        <ProgressStats />
      </section>
    </div>
  )
}

// クイックアクセスカード
function QuickAccessCard({
  to,
  icon,
  title,
  description,
  accentColor,
}: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
  accentColor: "indigo" | "amber"
}) {
  const colorClasses = {
    indigo: {
      bg: "bg-indigo-50",
      text: "text-indigo-600",
      gradient: "from-indigo-500/10 to-transparent",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-600",
      gradient: "from-amber-500/10 to-transparent",
    },
  }

  const colors = colorClasses[accentColor]

  return (
    <Link
      to={to}
      className="card-hover group p-6"
    >
      {/* 背景グラデーション */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="relative flex items-center gap-5">
        {/* アイコン */}
        <div className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}>
          <span className={colors.text}>{icon}</span>
        </div>

        {/* テキスト */}
        <div>
          <h3 className="font-semibold text-ink-900 text-lg mb-0.5 group-hover:text-indigo-700 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-ink-600">{description}</p>
        </div>

        {/* 矢印 */}
        <div className="ml-auto text-ink-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all duration-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </Link>
  )
}
