import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/subjects/")({
  beforeLoad: () => {
    throw redirect({
      to: "/domains",
      replace: true,
    })
  },
})
