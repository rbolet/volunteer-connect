// Server-only BFF → Express client (CROSSCONTEXT_TODOS.md → Trusted BFF
// Header). Attaches the shared secret plus the resolved session as headers;
// Express re-validates both. Never import from a client component — the
// secret must not reach the browser bundle.
import type { ResolvedSession } from "@vc/types"

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(`API ${status}: ${code}`)
    this.name = "ApiError"
  }
}

function requiredEnv(name: "API_URL" | "TRUSTED_BFF_SECRET"): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export async function apiFetch(
  path: string,
  init: RequestInit & { session?: ResolvedSession } = {}
): Promise<Response> {
  const { session, ...rest } = init
  const headers = new Headers(rest.headers)
  headers.set("x-bff-secret", requiredEnv("TRUSTED_BFF_SECRET"))
  if (session) headers.set("x-session", JSON.stringify(session))
  if (rest.body) headers.set("content-type", "application/json")

  const res = await fetch(`${requiredEnv("API_URL")}${path}`, {
    ...rest,
    headers,
    // Always live data — the BFF is the cache boundary, and demo data mutates.
    cache: "no-store",
  })
  if (!res.ok) {
    const code = await res
      .json()
      .then((body: { error?: string }) => body.error ?? "unknown_error")
      .catch(() => "unknown_error")
    throw new ApiError(res.status, code)
  }
  return res
}

export async function apiGetJson<T>(path: string, session: ResolvedSession): Promise<T> {
  const res = await apiFetch(path, { session })
  return res.json() as Promise<T>
}
