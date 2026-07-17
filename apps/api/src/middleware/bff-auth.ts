import { createHash, timingSafeEqual } from "node:crypto"
import type { NextFunction, Request, Response } from "express"
import { resolvedSessionSchema } from "@vc/zod"

// Express is internal-only (Railway private network), but per defense-in-depth
// it still refuses anything that doesn't carry the BFF's shared secret and a
// validated session payload (CROSSCONTEXT_TODOS.md → Trusted BFF Header).
export const BFF_SECRET_HEADER = "x-bff-secret"
export const SESSION_HEADER = "x-session"

// Hash both sides so timingSafeEqual gets equal-length buffers regardless of
// what the caller sent — a length mismatch would otherwise throw/short-circuit.
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

export function requireBffSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.TRUSTED_BFF_SECRET
  if (!expected) {
    // Fail closed: a missing secret is a deployment error, not an open door.
    res.status(500).json({ error: "server_misconfigured" })
    return
  }
  const provided = req.header(BFF_SECRET_HEADER)
  if (!provided || !secretMatches(provided, expected)) {
    res.status(401).json({ error: "unauthorized" })
    return
  }
  next()
}

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const raw = req.header(SESSION_HEADER)
  if (!raw) {
    res.status(401).json({ error: "missing_session" })
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    res.status(401).json({ error: "invalid_session" })
    return
  }
  const result = resolvedSessionSchema.safeParse(parsed)
  if (!result.success) {
    res.status(401).json({ error: "invalid_session" })
    return
  }
  req.session = result.data
  next()
}
