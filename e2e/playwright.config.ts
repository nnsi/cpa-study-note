import { defineConfig, devices } from "@playwright/test"
import path from "path"

const isCI = !!process.env.CI

export default defineConfig({
  testDir: path.resolve(__dirname, "specs"),
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? "github" : "html",
  use: {
    baseURL: "http://localhost:4568",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      testDir: path.resolve(__dirname, "fixtures"),
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.resolve(__dirname, ".auth/user.json"),
      },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: "npx tsx --tsconfig e2e/tsconfig.json e2e/server/test-server.ts",
      port: 4567,
      reuseExistingServer: !isCI,
      cwd: path.resolve(__dirname, ".."),
      env: {
        NODE_OPTIONS: "--import tsconfig-paths/register",
        TS_NODE_PROJECT: path.resolve(__dirname, "tsconfig.json"),
      },
    },
    {
      command: "pnpm --filter @cpa-study/web exec vite --config vite.config.e2e.ts",
      port: 4568,
      reuseExistingServer: !isCI,
      cwd: path.resolve(__dirname, ".."),
    },
  ],
})
