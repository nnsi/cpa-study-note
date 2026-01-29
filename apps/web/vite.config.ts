import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { TanStackRouterVite } from "@tanstack/router-vite-plugin"
import path from "path"

export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true, // 外部からのアクセスを許可（0.0.0.0でリッスン）
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787", // IPv4を明示的に指定
        changeOrigin: true,
      },
    },
  },
})
