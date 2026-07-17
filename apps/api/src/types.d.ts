import type { ResolvedSession } from "@vc/types"

// `session` is attached by the requireSession middleware (middleware/bff-auth.ts)
// after validating the trusted BFF header. Optional because pre-session routes
// (/health, /internal/*) never have it.
declare global {
  namespace Express {
    interface Request {
      session?: ResolvedSession
    }
  }
}

export {}
