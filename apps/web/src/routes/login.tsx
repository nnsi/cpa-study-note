import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useAuthStore, isDevMode, devLogin } from "@/lib/auth"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

const providers = [
  {
    id: "google",
    label: "Googleでログイン",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
]

function LoginPage() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) {
      navigate({ to: "/" })
    }
  }, [isAuthenticated, navigate])

  const handleLogin = (providerId: string) => {
    window.location.href = `/api/auth/${providerId}`
  }

  const handleDevLogin = async () => {
    setIsLoading(true)
    try {
      const success = await devLogin()
      if (success) {
        navigate({ to: "/" })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-72px)] px-4 -mt-8">
      {/* 背景装飾 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-indigo-100/50 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-amber-100/30 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* カード */}
        <div className="card p-8 lg:p-10">
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-soft">
                <span className="text-white font-serif font-bold text-2xl">会</span>
              </div>
            </div>
            <h1 className="heading-serif text-2xl mb-2">ログイン</h1>
            <p className="text-ink-500">
              アカウントでログインして学習を始めましょう
            </p>
          </div>

          {/* ログインボタン */}
          <div className="space-y-3">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleLogin(provider.id)}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white border border-ink-200 rounded-xl hover:bg-ink-50 hover:border-ink-300 hover:shadow-soft transition-all duration-200 group"
              >
                <span className="group-hover:scale-110 transition-transform duration-200">
                  {provider.icon}
                </span>
                <span className="font-medium text-ink-700">{provider.label}</span>
              </button>
            ))}

            {/* 開発用ログイン */}
            {isDevMode && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full divider" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-white text-xs text-ink-400 uppercase tracking-wider">
                      開発用
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleDevLogin}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 text-amber-800 rounded-xl hover:from-amber-100 hover:to-amber-200 hover:shadow-soft transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23.693L5 15.3m6.75 3.45V21m0-2.25h-.008v.008h.008v-.008Zm0 2.25h.008v.008H12v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  <span className="font-medium">テストユーザーでログイン</span>
                </button>
              </>
            )}
          </div>

          {/* 利用規約 */}
          <p className="mt-8 text-center text-xs text-ink-400 leading-relaxed">
            ログインすることで、
            <a href="#" className="text-indigo-500 hover:text-indigo-600 hover:underline">利用規約</a>
            と
            <a href="#" className="text-indigo-500 hover:text-indigo-600 hover:underline">プライバシーポリシー</a>
            に同意したものとみなされます。
          </p>
        </div>
      </div>
    </div>
  )
}
