import { execSync } from "node:child_process"
import path from "node:path"

// Reset the demo org before every E2E run: the admin specs award points and
// create signups — durable mutations the suite can't undo — so each run
// starts from the canonical seed state. Resetting is exactly what the demo
// org is designed for (DEMO_MODE.md's reset job runs the same script).
export default function globalSetup(): void {
  execSync("pnpm --filter @vc/db db:reset-demo", {
    cwd: path.resolve(__dirname, "..", "..", ".."),
    stdio: "inherit",
  })
}
