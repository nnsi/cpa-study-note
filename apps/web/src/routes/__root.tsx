import { useEffect } from "react"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { Layout } from "@/components/layout"
import { GlobalSearchModal, useSearchModal, isSearchShortcut } from "@/features/search"
import { useAuthStore } from "@/lib/auth"

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  const { isOpen, query, setQuery, open, close } = useSearchModal()
  const loggedIn = useAuthStore((state) => state.isAuthenticated())

  // Ctrl+K / Cmd+K でモーダルを開く
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loggedIn && isSearchShortcut(e)) {
        e.preventDefault()
        open()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [loggedIn, open])

  return (
    <>
      <Layout onSearchClick={open}>
        <Outlet />
      </Layout>
      {loggedIn && (
        <GlobalSearchModal
          isOpen={isOpen}
          query={query}
          setQuery={setQuery}
          onClose={close}
        />
      )}
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  )
}
