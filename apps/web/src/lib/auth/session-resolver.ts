import { cache } from "react"
import { cookies } from "next/headers"
import { demoSessionResponseSchema } from "@vc/zod"
import type { DemoSessionResponse, ResolvedSession } from "@vc/types"
import { ApiError, apiFetch } from "@/lib/api/client"
import { DEMO_COOKIE, verifyDemoCookie } from "./demo-cookie"

// AUTH.md's SessionResolver, adapted to the App Router: there is no NextRequest
// in server components/actions, so resolvers read request context via
// next/headers instead of a req argument. Middleware (src/middleware.ts) is
// route-dispatch + cookie issuance only — Edge can't run DB lookups.
export interface SessionResolver {
  resolve(): Promise<ResolvedSession | null>
}

// Full demo context (session + display user + identity) for the banner and
// "view as" switcher. react cache() dedupes the internal API call per request.
export const getDemoSession = cache(async (): Promise<DemoSessionResponse | null> => {
  const secret = process.env.DEMO_SESSION_SECRET
  if (!secret) return null
  const store = await cookies()
  // Middleware guarantees a cookie on /demo/*; fall back to the same default
  // it would issue, so a race (first request) still resolves.
  const identity = (await verifyDemoCookie(store.get(DEMO_COOKIE)?.value, secret)) ?? "volunteer"
  try {
    const res = await apiFetch(`/internal/demo-session?identity=${identity}`)
    return demoSessionResponseSchema.parse(await res.json())
  } catch (err) {
    // 503 = demo org not seeded yet — surface as "no session" rather than a crash.
    if (err instanceof ApiError && err.status === 503) return null
    throw err
  }
})

export const demoSessionResolver: SessionResolver = {
  async resolve() {
    return (await getDemoSession())?.session ?? null
  },
}

// Real Supabase auth is deferred (see __docs/AUTH.md): until it lands,
// everything outside /demo/* is unauthenticated by definition.
export const supabaseSessionResolver: SessionResolver = {
  async resolve() {
    return null
  },
}

/** Route-based dispatch per AUTH.md — the pathname decides the resolver, never client input. */
export function resolverFor(pathname: string): SessionResolver {
  return pathname.startsWith("/demo") ? demoSessionResolver : supabaseSessionResolver
}
