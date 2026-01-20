import { execSync } from "child_process"
import { existsSync, mkdirSync } from "fs"
import { join } from "path"

const migrationsDir = join(process.cwd(), "migrations")

if (!existsSync(migrationsDir)) {
  mkdirSync(migrationsDir, { recursive: true })
}

// Generate migration using drizzle-kit
execSync("npx drizzle-kit generate", { stdio: "inherit" })

console.log("Migration files generated in ./migrations")
console.log("Use wrangler d1 migrations apply to apply migrations")
