import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror tsconfig's "@/*" → "./src/*" alias for tests.
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // e2e/ is Playwright's, not vitest's.
    exclude: ["e2e/**", "node_modules/**"],
  },
})
