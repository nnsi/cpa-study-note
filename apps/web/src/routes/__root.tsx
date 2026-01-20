import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { Layout } from "@/components/layout"

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <Layout>
        <Outlet />
      </Layout>
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  )
}
