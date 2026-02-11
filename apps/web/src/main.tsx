import { StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { ToastContainer } from "./lib/toast"
import { initializeAuth } from "./lib/auth"
import "./index.css"
import "katex/dist/katex.min.css"

// QueryClient設定（パフォーマンス最適化）
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5分間キャッシュ有効
      gcTime: 1000 * 60 * 30, // 30分間ガベージコレクション猶予
      retry: 1,
      refetchOnWindowFocus: false, // ウィンドウフォーカス時の再取得を無効
    },
    mutations: {
      retry: 0,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// ローディングフォールバック
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full size-12 border-b-2 border-indigo-600" />
  </div>
)

const rootElement = document.getElementById("root")!

// Initialize auth before rendering (skip for auth/callback page)
const isAuthCallback = window.location.pathname === "/auth/callback"

const startApp = async () => {
  if (!isAuthCallback) {
    await initializeAuth()
  }

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<LoadingFallback />}>
            <RouterProvider router={router} />
          </Suspense>
          <ToastContainer />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  )
}

startApp()
