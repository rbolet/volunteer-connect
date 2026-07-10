# Auth — Session Resolution Architecture

Load on demand. Referenced from CLAUDE.md and DEMO_MODE.md.

**Status: proposed design, not yet implemented.** No auth code exists in the repo today — no `@supabase/ssr` integration, no session handling, no RLS policies in the deployed schema. This doc is the target architecture, written now because [DEMO_MODE.md](DEMO_MODE.md) needs a session source that isn't Supabase Auth, and retrofitting an adapter boundary after the Supabase-only path is hardcoded would mean touching every downstream consumer twice. Treat this as the auth design to build against, not a record of something already running.

## Why an interface, not a Supabase call site

The BFF pattern (CLAUDE.md → Architecture) says Next.js validates the session and forwards `user_id` + `org_id` to Express over a trusted header. As originally phrased, that assumes the only way to obtain a session is a real Supabase login. Demo mode needs a second, password-less source that still produces a session Express, RLS, and Zod schemas can't distinguish from a real one. The fix is to put a `SessionResolver` interface at the point where Next.js middleware currently would have called `@supabase/ssr` directly, with Supabase as one implementation and demo as another. Every downstream layer only ever sees the resolved session shape — never which resolver produced it.

## Session shape

```ts
// packages/types/src/session.ts
interface ResolvedSession {
  user_id: string
  org_id: string
  org_roles: OrgRoleType[] // e.g. ["admin"], or [] for a non-admin
  team_roles: { team_id: string; role: TeamRole }[]
  source: "supabase" | "demo" // server-set, drives the demo banner — see DEMO_MODE.md
}
```

This is the payload that gets attached as the trusted internal header to Express (the still-unbuilt forwarding code tracked in `CROSSCONTEXT_TODOS.md`). `source` is the one field that exists purely for UI purposes (the demo banner); nothing in RLS or business logic should branch on it — org/role scoping does that work.

## Interface

```ts
// apps/web/src/lib/auth/session-resolver.ts
interface SessionResolver {
  resolve(req: NextRequest): Promise<ResolvedSession | null>
}
```

`null` means unauthenticated — middleware redirects to sign-in (real path) or the request simply isn't eligible for a resolver (demo path never returns null for `/demo/*` routes since it doesn't gate on credentials).

### `SupabaseSessionResolver`

- Reads the Supabase session cookie via `@supabase/ssr`'s `createServerClient`.
- On a valid session, looks up the app-level `User` row by `auth_id` (Supabase user id) to get `org_id`, then joins `OrgRole` + `TeamMembership` to fill `org_roles` / `team_roles`.
- Returns `null` on missing/expired session.
- This is the only resolver that ever touches a raw Supabase JWT — consistent with "Express never handles raw Supabase tokens."

### `DemoSessionResolver`

- Never reads cookies or validates credentials. Looks up one of a small, fixed set of seeded demo users (one per `TeamRole` + one org admin — see [DEMO_MODE.md](DEMO_MODE.md#seed-script)) scoped to a single, hardcoded demo `org_id` read from `DEMO_ORG_ID` (env var, not request input).
- **The demo org id must never be accepted from the client** — not a query param, not a body field, not a cookie value the resolver trusts uncritically. If it were, a crafted request could ask the demo resolver to mint a session for an arbitrary `org_id`. The resolver reads `DEMO_ORG_ID` from server env only and rejects any request path outside `/demo/*`.
- Which of the fixed demo users to impersonate (for the "view as Admin/Coach/Referee/Volunteer" switcher) is the _only_ thing a demo request may select, and only from an enum of the seeded demo user ids for that org — never a free-form user id.
- Issues its own signed session cookie (e.g. `demo_session`, HMAC-signed with a server secret, containing just the selected demo user id) so the "view as" switch survives navigation without going through Supabase at all.

## Where this plugs in

Next.js middleware (`apps/web/src/middleware.ts`, not yet created) picks a resolver by **route**, not by any client-supplied flag:

```
/demo/*        → DemoSessionResolver
everything else → SupabaseSessionResolver
```

This is the entire demo/prod boundary. Because it's a route-based dispatch evaluated server-side in middleware, there is no code path where a request outside `/demo/*` can end up with a demo session, and no code path where `/demo/*` can end up with a real one.

## Dependency: RLS

Downstream of session resolution, Postgres RLS is expected to enforce `org_id` scoping on every table using `current_setting('app.org_id')` (or equivalent), set per-request by the Express layer from the trusted header. **No RLS policies exist in the current migration at all** — not even single-org scoping for the one org that exists today. This is a prerequisite for both real multi-org safety and demo isolation; it is not demo-specific and shouldn't be designed as part of the demo work. Tracked as a new item in `CROSSCONTEXT_TODOS.md`.

## Open decisions

- **Where `DemoSessionResolver`'s signed cookie secret lives** — reuse `TRUSTED_BFF_SECRET` or a distinct `DEMO_SESSION_SECRET`. Recommend a distinct secret so rotating one doesn't require also rotating the other.
- **Middleware vs. per-route-handler dispatch** — Next.js middleware is the natural place (runs before any route handler), but confirm it has access to whatever cookie/env reads each resolver needs under the Edge runtime constraints Next.js middleware imposes (no arbitrary Node APIs). If `@supabase/ssr`'s server client needs Node-only APIs, resolver dispatch may need to move into route handlers / a shared helper called from each route instead of true middleware.
- **This doc assumes the BFF trusted-header forwarding code (`CROSSCONTEXT_TODOS.md`) is built against `ResolvedSession`**, not against an ad hoc `{user_id, org_id}` pair. Confirm before that item is picked up so it isn't built twice.
