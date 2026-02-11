import { defineConfig, mergeConfig } from "vite"
import baseConfig from "./vite.config"

export default mergeConfig(
  baseConfig,
  defineConfig({
    server: {
      port: 4568,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:4567",
          changeOrigin: true,
        },
      },
    },
  })
)
