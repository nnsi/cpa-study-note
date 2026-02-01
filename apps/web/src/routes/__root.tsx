import { useEffect } from "react"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { Layout } from "@/components/layout"
import { GlobalSearchModal, useSearchModal, isSearchShortcut } from "@/features/search"

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  const { isOpen, query, setQuery, open, close } = useSearchModal()

  // Ctrl+K / Cmd+K でモーダルを開く
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSearchShortcut(e)) {
        e.preventDefault()
        open()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open])

  return (
    <>
      <Layout onSearchClick={open}>
        <Outlet />
      </Layout>
      <GlobalSearchModal
        isOpen={isOpen}
        query={query}
        setQuery={setQuery}
        onClose={close}
      />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  )
}
