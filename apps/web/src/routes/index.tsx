import { createFileRoute, Link } from "@tanstack/react-router"
import { useAuthStore } from "@/lib/auth"
import { ProgressStats } from "@/features/progress"
import { MiniMetricsChart } from "@/features/metrics"
import { TodayActivityCard, RecentTopicsList } from "@/features/home"
import { PageWrapper } from "@/components/layout"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated()) {
    return <LandingPage />
  }

  return (
    <PageWrapper>
      <DashboardPage user={user} />
    </PageWrapper>
  )
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

      <div className="relative text-center max-w-xl animate-fade-in-up">
        {/* メインタイトル */}
        <h1 className="heading-serif text-4xl lg:text-5xl text-ink-900 mb-4 leading-tight">
          InkTopik
        </h1>
        <p className="text-xl lg:text-2xl text-gradient font-medium mb-8">
          学習の痕跡を、論点に残す
        </p>

        {/* サブタイトル */}
        <p className="text-lg text-ink-600 mb-10 leading-relaxed">
          分からなかったこと。聞いたこと。理解したこと。
          <br className="hidden sm:block" />
          すべてが論点に紐づき、後から振り返れます。
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
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left sm:text-center">
          {[
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              ),
              label: "論点に集まる",
              description: "質問もノートも迷いも、すべて論点に紐づく",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              ),
              label: "後から見える",
              description: "どこに時間を使ったか、事実として残る",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              ),
              label: "主教材と併用",
              description: "テキストや問題集の学習を邪魔しない",
            },
          ].map((feature, i) => (
            <div
              key={feature.label}
              className={`flex sm:flex-col items-start sm:items-center gap-4 sm:gap-2 animate-fade-in-up animation-delay-${(i + 1) * 100}`}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                {feature.icon}
              </div>
              <div>
                <div className="font-medium text-ink-800 mb-1">{feature.label}</div>
                <div className="text-sm text-ink-500">{feature.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 補足（思想の表明） */}
        <p className="mt-16 text-sm text-ink-400 max-w-md mx-auto">
          このアプリは学習を教えません。
          <br />
          代わりに、学習がうまくいっている状態を再現可能な形で残します。
        </p>

        {/* フッターリンク */}
        <div className="mt-12 flex items-center justify-center gap-4 text-sm text-ink-400">
          <Link to="/terms" className="hover:text-indigo-600 transition-colors">
            利用規約
          </Link>
          <span className="text-ink-300">|</span>
          <Link to="/privacy" className="hover:text-indigo-600 transition-colors">
            プライバシーポリシー
          </Link>
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

      {/* 今日の活動 + 最近の論点 */}
      <div className="grid gap-4 md:grid-cols-2">
        <TodayActivityCard />
        <RecentTopicsList />
      </div>

      {/* クイックアクセス */}
      <div className="grid gap-4 md:grid-cols-3">
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
          to="/review"
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
          }
          title="論点フィルタ"
          description="復習が必要な論点を抽出"
          accentColor="jade"
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

      {/* 日次推移グラフ（簡易版） */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="heading-serif text-xl">学習推移</h2>
          <div className="flex-1 divider" />
        </div>
        <MiniMetricsChart />
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
  accentColor: "indigo" | "amber" | "jade"
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
    jade: {
      bg: "bg-jade-100",
      text: "text-jade-600",
      gradient: "from-jade-500/10 to-transparent",
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
