# Real-auth route tree (deferred — blocked on `SupabaseSessionResolver`)

Status: **deferred, not started.** Blocked on `SupabaseSessionResolver` (currently a stub returning `null` — `apps/web/src/lib/auth/session-resolver.ts:43-47`) being implemented against real `@supabase/ssr` sessions. Pick this up alongside that work, not before it.

## Context

`apps/web/src/app/demo/` was restructured (2026-07-23) so that everything reusable — the dashboard, signups, teams, signup-templates UI, and their server actions — now lives in `apps/web/src/features/` and `apps/web/src/components/shared/`, imported by thin `page.tsx` files under `app/demo/`. Only genuinely demo-only code (the banner, the "view as" switcher, the unseeded-org fallback) remains inside `app/demo/`. See `__docs/FRONTEND.md`'s Directory Structure section for the current shape.

That reorg was intentionally scoped to not touch routing or auth — `/demo/*` stays the only reachable URL prefix for now, because `resolverFor()` (`session-resolver.ts:50-52`) dispatches purely on the `/demo` path prefix: `/demo/*` → `demoSessionResolver`, everything else → the stub. This doc is the follow-up: what changes once `SupabaseSessionResolver` is real, so a real logged-in user can reach the same UI at normal (non-`/demo`) URLs without duplicating it.

## Decision: single route tree, cookie-based dispatch (not permanent `/demo/*` duplication)

Two designs were considered:

- **A — permanent `/demo/*` prefix.** Keep two `page.tsx` files per route forever (`/teams` and `/demo/teams`), both rendering the same `features/teams/teams-view.tsx`. Simple, very auditable security boundary (URL alone determines the resolver — `AUTH.md`'s current framing). Cost: permanently forks the URL space, and a demo visitor's URLs never match what a real user sees.
- **B — `/demo` as an entry point only (chosen).** One route tree (`/dashboard`, `/teams`, `/signups`, `/signup-templates`). Visiting `/demo` sets the signed demo cookie and redirects into it. `resolverFor()`/middleware dispatches per-request on **cookie validity** instead of URL prefix: valid signed `demo_session` cookie → `demoSessionResolver`; else a real Supabase session → `supabaseSessionResolver`; else unauthenticated. No duplicate pages, ever. This matches what `__docs/DEMO_MODE.md` (Frontend section) already says was intended: "`/demo` route... is a dedicated entry point... redirects into the normal app shell (`/dashboard` or equivalent)."

**Chosen: B.** Rationale: avoids permanent route duplication, matches already-documented intent, and the `features/` reorg was done specifically so this is a routing-layer change only — no UI/business logic needs to move again.

## What actually needs to change (scope of this future task)

1. **Middleware/dispatch**: `apps/web/src/middleware.ts` currently matches only `/demo`, `/demo/:path*`. Needs to run for all app routes (or at least all routes needing auth) and check for a valid signed `demo_session` cookie regardless of path, falling through to Supabase session resolution otherwise. `resolverFor()` in `session-resolver.ts` changes from path-based to cookie/session-based dispatch.
2. **`/demo` becomes a pure entry point**: instead of being a layout wrapping a whole route tree, `app/demo/page.tsx` (or a route handler) verifies/issues the demo cookie and redirects to `/dashboard`.
3. **New top-level route files**: `app/dashboard/page.tsx`, `app/teams/page.tsx`, `app/signups/page.tsx` (+ `[id]/`, `new/`), `app/signup-templates/page.tsx` (+ `new/`) — each a thin wrapper identical in shape to today's `app/demo/**/page.tsx` files, but resolving the session via `resolverFor()` (demo-or-real) instead of hardcoded `getDemoSession()`, then rendering the same `features/*/*-view.tsx` components. The old `app/demo/**/page.tsx` files are deleted once the top-level ones exist (no more `/demo/dashboard` etc. — `/demo` only ever redirects).
4. **`AppShell`/banner relocation**: `components/shared/app-shell.tsx` (already extracted) and the `session.source === "demo"` banner conditional move from `app/demo/layout.tsx` into whatever layout wraps the new top-level routes (likely the root layout, or a shared route-group layout). `app/demo/layout.tsx` goes away along with the old page tree.
5. **Hrefs**: the `features/*` view components currently hardcode `/demo/...` in every `<Link>` (dashboard cross-links, "All signups" back-links, etc. — by design, this was left as-is in the reorg since parameterizing them wasn't justified without a second route tree to serve). These all need updating to the new top-level paths as part of this task.
6. **`switchIdentity`/`demo-banner.tsx`**: unaffected — still demo-only, still live wherever the `/demo` entry point ends up.

## Explicitly not part of this task

- Implementing `SupabaseSessionResolver` itself (reading the Supabase cookie, looking up `org_id`/roles) — that's a prerequisite, tracked separately per `AUTH.md`'s open decisions (e.g., how a new real user gets an `org_id` on first login).
- Any RLS work — tracked in `CROSSCONTEXT_TODOS.md`.
