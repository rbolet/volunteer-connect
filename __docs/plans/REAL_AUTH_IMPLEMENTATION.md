# Real Auth (Supabase) + Route Tree Collapse — Implementation Tracker

**Status: Phase 0 — planned, not started.** This is the active build-out doc for real user auth. Written so a **clean session with no prior context can pick up any phase using this doc plus the referenced "living" docs (`AUTH.md`, `DATA_MODEL.md`, `DEMO_MODE.md`, `FRONTEND.md`, `API.md`) — without needing to grep the codebase first.** Update the status line and check off items as work lands; each phase should end with a session-log entry (`__docs/sessions/YYYY-MM-DD.md`) noting what actually landed, per CLAUDE.md's session-log convention.

**Progress**: ☐ Phase 1 · ☐ Phase 2 · ☐ Phase 3 · ☐ Phase 4 · ☐ Phase 5

## Context

`apps/web/src/app/demo/` was restructured (2026-07-23) so that everything reusable — dashboard, signups, teams, signup-templates UI, and their server actions — now lives in `apps/web/src/features/` and `apps/web/src/components/shared/`, imported by thin `page.tsx` files under `app/demo/`. Only genuinely demo-only code (banner, "view as" switcher, unseeded-org fallback) remains inside `app/demo/`. See `FRONTEND.md`'s Directory Structure section for the current shape. That reorg was intentionally scoped to not touch routing/auth, specifically so this doc's work would be routing- and auth-layer only, no further UI moves.

`SupabaseSessionResolver` (`apps/web/src/lib/auth/session-resolver.ts:43-47`) has always been a stub returning `null`, so `/demo/*` is currently the only reachable route tree.

## Decisions (resolved — do not re-litigate; re-derive only if something below turns out to be wrong once implemented)

1. **Route design: single route tree, cookie-based dispatch** (not a permanent `/demo/*` duplicate tree). `/demo` becomes a pure entry point: sets the signed demo cookie, redirects to `/dashboard`. `resolverFor()` dispatches on cookie/session validity, not URL prefix.
2. **Org assignment: invite-only.** A real user gets an `org_id` by redeeming an `OrgInvite`. Building the _admin-facing UI to issue invites_ is out of scope for this effort — invite rows are created via a CLI script (Phase 1) for UAT/early use. A future "admin issues invite" feature is a create-row UI on top of this same table/endpoint, not a rebuild.
3. **Invite token format: human-readable/typeable, not opaque.** Blast radius is limited by design — an invite only lets someone create a new **plain, non-admin org member** (see decision 5), single-use, expiring. That capped downside is why a short, typeable code is an acceptable trade against a long opaque token here. See Phase 1 for the exact alphabet/length.
4. **Sign-in method: email + password** via Supabase Auth. No magic link, no OAuth, no password reset yet.
5. **New users get no elevated role at signup.** Redeeming an invite creates a `User` row scoped to the invite's `org_id` — nothing else. No `OrgRole` (admin) is granted, and no `TeamMembership` is created (team joining is already self-service per `DATA_MODEL.md` and is unaffected/unchanged by this work). Promoting a user to org admin for testing purposes is a **direct DB edit** for now (Prisma Studio) — building in-app role-change functionality is explicitly out of scope for this effort.
6. **Scope: both** `SupabaseSessionResolver` and the route-tree collapse together, in the phases below — not staged as separate efforts.

## Phase 1 — Schema + Express (no UI; independently Supertest-testable)

Nothing in `apps/web` depends on this phase. Can be built and merged first, verified with Supertest alone.

### Schema

- [ ] `packages/db/prisma/schema.prisma` — add:
  ```prisma
  model OrgInvite {
    id          String       @id @default(cuid())
    org_id      String
    token       String       @unique   // human-readable code, e.g. "7K4M9XQP" — see Token format below
    email       String?                // optional pin — if set, redemption must match
    expires_at  DateTime
    redeemed_at DateTime?
    redeemed_by String?
    created_at  DateTime     @default(now())
    updated_at  DateTime     @updatedAt
    created_by  String?
    updated_by  String?
    deleted_at  DateTime?

    org Organization @relation(fields: [org_id], references: [id])
  }
  ```
  Add `orgInvites OrgInvite[]` to the `Organization` model. Follows the existing audit-field convention used by every non-pivot entity (plain nullable `created_by`/`updated_by`, no FK relation on those — see `Organization`/`User` in the same file for the pattern). No `role` field — see Decision 5, invites never grant `OrgRole`.
- [ ] Generate + apply the migration (`packages/db/prisma/migrations/`).

### Token format

- Alphabet: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (32 symbols — excludes `0/O/1/I/L` to avoid transcription errors when read aloud or hand-typed).
- Length: 8 characters → 40 bits of entropy. Optionally display grouped (`XXXX-XXXX`) for readability; store ungrouped.
- Generate with `crypto.randomInt(alphabet.length)` per character (Node `crypto`, not `Math.random`).
- Rationale for keeping it short/typeable rather than an opaque UUID-style token (Decision 3): the token can only be used to create a new plain org member (Decision 5) — no admin access, no data access beyond what any new member would have — and redemption is single-use + time-limited (`expires_at`). If this ever needs to gate something higher-privilege, revisit toward a longer opaque token; don't silently extend today's short-token design to a higher-stakes use case later.

### Docs (do alongside the schema change, per CLAUDE.md — propose schema changes in `DATA_MODEL.md`, not just in code)

- [x] `__docs/DATA_MODEL.md` — `OrgInvite` entity section added (this session).
- [x] `__docs/AUTH.md` — org-assignment open decision resolved (this session).

### Zod schemas

- [ ] `packages/zod/src/org-invite.ts` (new):
  ```ts
  export const inviteRedeemInputSchema = z.object({
    token: z.string().min(1),
    authId: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
  })
  export type InviteRedeemInput = z.infer<typeof inviteRedeemInputSchema>

  export const inviteValidateResponseSchema = z.object({ org_id: z.string(), org_name: z.string() })
  export type InviteValidateResponse = z.infer<typeof inviteValidateResponseSchema>
  ```
  Export both from `packages/zod/src/index.ts`.
- [ ] `packages/zod/src/session.ts` — factor out a shared base so both demo and real-user session responses use one Zod type:
  ```ts
  export const appSessionResponseSchema = z.object({
    user: z.object({ id: z.string().min(1), name: z.string().min(1), email: z.string().email() }),
    session: resolvedSessionSchema,
  })
  export type AppSessionResponse = z.infer<typeof appSessionResponseSchema>

  export const demoSessionResponseSchema = appSessionResponseSchema.extend({
    identity: demoIdentitySchema,
  })
  ```
  Re-export `AppSessionResponse` from `packages/types/src/session.ts` and `packages/types/src/index.ts` alongside the existing three session types.

### Express repositories

Mirror `apps/api/src/repositories/demo-session.ts` exactly — same shape (`interface XRepo { ... }`, `createXRepo(prisma)` factory), same style of Prisma queries (`findFirst` with `deleted_at: null`, join `orgRoles`/`teamMemberships`).

- [ ] `apps/api/src/repositories/user-session.ts` — `UserSessionRepo.resolve(authId): Promise<AppSessionResponse | null>`. Finds `User` by `auth_id` (+ `deleted_at: null`), joins `orgRoles`/`teamMemberships`, builds `ResolvedSession` with `source: "supabase"`. Returns `null` when no `User` row exists — this is the "needs org" signal the web layer (Phase 2) keys off of.
- [ ] `apps/api/src/repositories/org-invites.ts`:
  ```ts
  export type ValidateResult =
    | { ok: true; org_id: string; org_name: string }
    | { ok: false; reason: "not_found" | "expired" | "redeemed" }
  export type RedeemResult =
    | { ok: true; userId: string }
    | { ok: false; reason: "not_found" | "expired" | "redeemed" | "email_mismatch" }
  export interface OrgInvitesRepo {
    validate(token: string): Promise<ValidateResult>
    redeem(
      token: string,
      input: { authId: string; email: string; name: string }
    ): Promise<RedeemResult>
  }
  ```
  `redeem()` runs inside one `prisma.$transaction`: re-fetch the invite by token (`deleted_at: null`), re-check not expired/redeemed, soft-check `email` pin if set, create `User` (`org_id` from invite, `auth_id`, `email`, `name` — **no `OrgRole`, no `TeamMembership`**, per Decision 5), stamp `redeemed_at`/`redeemed_by`. `User.auth_id` is already `@unique` in the schema, so a double-redeem race against the same Supabase account fails safely at the DB constraint even though the invite-row check itself has a small accepted TOCTOU window (fine at pilot concurrency — don't over-engineer locking here).
- [ ] `apps/api/src/repositories/index.ts` — add `userSession: UserSessionRepo` and `orgInvites: OrgInvitesRepo` to the `Repos` interface and `createRepos()`.

### Express routes

All under `apps/api/src/routes/internal.ts`, gated the same way `/demo-session` is (`requireBffSecret` only — these run **pre-session**, before a `ResolvedSession` exists to validate):

- [ ] `GET /internal/user-session?auth_id=<id>` → 404 `{error:"user_not_found"}` when `resolve()` returns null, else 200 `AppSessionResponse`.
- [ ] `GET /internal/invites/:token/validate` → `validate()`; map `not_found`→404, `expired`→410, `redeemed`→409, else 200 `{org_id, org_name}`.
- [ ] `POST /internal/invites/redeem` (body validated against `inviteRedeemInputSchema`) → `redeem()`; same status mapping as validate, plus `email_mismatch`→400, else 200 `{userId}`.

### CLI script (the actual UAT invite-creation path, since there's no admin UI)

- [ ] `packages/db/scripts/create-invite.ts` — CLI: `pnpm --filter @vc/db exec tsx scripts/create-invite.ts --org-id <id> [--email <pin>] [--days 14]`. Generates a token per the format above, inserts the `OrgInvite` row via Prisma, prints `Invite created: <token>` and the equivalent `/sign-up?invite=<token>` URL. Look up the target `org_id` via `prisma.organization.findFirst({ where: { is_demo: false } })` if `--org-id` isn't passed, or list orgs and prompt — keep it simple, this is a dev-only tool.

### Tests

- [ ] Extend `apps/api/src/__tests__/internal.routes.test.ts` for `GET /internal/user-session` (401 without BFF secret, 404 when unresolved, 200 with a fake-repo-backed `AppSessionResponse` — mirror the existing demo-session test's fake-repo injection pattern).
- [ ] New `apps/api/src/__tests__/org-invites.routes.test.ts` — status-code matrix for both endpoints (all `reason` values → their mapped status).
- [ ] Repo-level test for `redeem()`'s transaction — creates `User` correctly, rejects a second redeem of the same token, rejects an expired token, rejects on email-pin mismatch. Use the mocked/in-memory Prisma pattern the existing repo tests already use (see `TESTING.md`'s file-layout table for where this convention is documented).

## Phase 2 — Resolver + Middleware

Depends on Phase 1's Express endpoints existing (calls them, doesn't need the UI from Phase 3/4 to test the dispatch logic itself — Vitest can mock the Supabase client and `apiFetch`).

- [ ] `apps/web/src/lib/auth/supabase-server.ts` (new) — single `createSupabaseServerClient()` factory using `@supabase/ssr`'s `createServerClient`, bound to `next/headers`' async `cookies()`. Wrap `setAll` in try/catch (cookie writes aren't allowed from Server Components, only Server Actions/Route Handlers — the try/catch makes the same factory safely callable from both). This is the standard `@supabase/ssr` Next.js App Router pattern (see Supabase's own Next.js server-side auth guide) — implement it directly from that reference rather than re-deriving the cookie-adapter shape from scratch.
- [ ] `apps/web/src/lib/auth/session-resolver.ts`:
  - [ ] Implement `supabaseSessionResolver.resolve()`: get the Supabase user via `createSupabaseServerClient().auth.getUser()`; if present, call `GET /internal/user-session?auth_id=<id>`; return the parsed `ResolvedSession`, or `null` on a 404 (mirrors the plain `SessionResolver` interface's existing `null` = "no session" contract).
  - [ ] Change `resolverFor()` — drop the `pathname` argument entirely; dispatch purely on demo-cookie validity (valid cookie → `demoSessionResolver`, else → `supabaseSessionResolver`).
  - [ ] Add `getAppSession()` (React `cache()`-wrapped, mirrors the existing `getDemoSession()`): a discriminated union —
    ```ts
    type AppSession =
      | {
          status: "demo"
          user: { id; name; email }
          identity: DemoIdentity
          session: ResolvedSession
        }
      | { status: "authenticated"; user: { id; name; email }; session: ResolvedSession }
      | { status: "needs_org"; authId: string; email: string }
      | { status: "unauthenticated" }
      | { status: "demo_unseeded" }
    ```
    This exists because "valid Supabase JWT but no `User` row yet" and "no session at all" need different redirects (`/sign-up` vs `/sign-in`) — the plain `SessionResolver`'s `ResolvedSession | null` can't express that distinction, and pages need it, so `getAppSession()` sits one layer above the plain interface rather than replacing it.
  - [ ] Add `requireAppSession()`: returns `{user, session}` for `demo`/`authenticated` statuses; redirects to `/sign-up?email=<email>` for `needs_org`, to `/sign-in` for everything else. This is what page components call (Phase 3).
- [ ] `apps/web/src/middleware.ts` — expand `config.matcher` to cover all app routes except `_next`/static assets. Public allowlist: `/`, `/sign-in`, `/sign-up`, `/demo`. Logic:
  1. Valid demo cookie → `NextResponse.next()`, never touch Supabase.
  2. `/demo` path → issue/refresh the demo cookie only (no redirect here anymore — see Phase 3, `app/demo/page.tsx` does the redirect now that it's Node-layer).
  3. Public path → pass through.
  4. Else: run the standard `@supabase/ssr` middleware pattern (`createServerClient` + `getUser()` + the `setAll`/`NextResponse.next({request})` cookie-refresh pattern from Supabase's Next.js middleware guide). No user → `redirect("/sign-in?next=<pathname>")`.
  - **Verify-before-building-on-top-of-it**: this repo has never run `@supabase/ssr` in Next Edge middleware before. Confidence is high it works (fetch-based, no Node built-ins, and it's Supabase's own documented pattern) but treat "does it actually build/run under this repo's Next config" as a checkpoint to confirm early in this phase — don't discover an incompatibility after Phase 3/4 are already built on top of it.
- [ ] Note in `AUTH.md` (already added, see below): middleware cannot make the `needs_org` distinction — that requires the Prisma-backed `/internal/user-session` call, which can't run at the Edge. A valid-JWT-but-unprovisioned user passes middleware and is redirected to `/sign-up` by `requireAppSession()` in the Node layer instead. This split is intentional.
- [ ] Vitest: `session-resolver.test.ts` — all 5 `getAppSession()` states, and that a valid demo cookie takes priority over a simultaneously-valid Supabase session.

## Phase 3 — Route Tree Collapse

Depends on Phase 2's `requireAppSession()`/`getAppSession()` existing. Pure refactor of already-working demo code — low risk if Phase 2 is solid.

- [ ] Create route group `apps/web/src/app/(app)/`:
  - [ ] `app/(app)/layout.tsx` — replaces `app/demo/layout.tsx`'s job: call `getAppSession()`; `demo_unseeded` → same fallback UI moved verbatim from the current `app/demo/layout.tsx`; `needs_org` → `redirect(`/sign-up?email=...`)`; `unauthenticated` → `redirect("/sign-in")`; otherwise render `AppShell` with `banner` (only when `status === "demo"`, using `DemoBanner`) and a new `headerActions` slot (sign-out — Phase 4).
  - [ ] `app/(app)/dashboard/page.tsx`, `teams/page.tsx`, `signups/page.tsx`, `signups/[id]/page.tsx`, `signups/new/page.tsx`, `signup-templates/page.tsx`, `signup-templates/new/page.tsx` — each is today's equivalent `app/demo/**/page.tsx` file moved as-is, with `getDemoSession()` swapped for `requireAppSession()`. (Read each existing `app/demo/**/page.tsx` file directly when doing this move — they're short and thin by design, per `FRONTEND.md`.)
- [ ] Delete `app/demo/dashboard/`, `app/demo/teams/`, `app/demo/signups/`, `app/demo/signup-templates/`, `app/demo/layout.tsx` once the new tree passes tests.
- [ ] `app/demo/page.tsx` (new) — pure entry point: `redirect("/dashboard")` (cookie already issued by middleware in Phase 2).
- [ ] `app/demo/actions.ts` (`switchIdentity`) and `app/demo/_components/demo-banner.tsx` **stay in place** — still demo-only, now imported from `app/(app)/layout.tsx`. Update `revalidatePath("/demo", "layout")` → the route group's equivalent — **confirm the exact Next.js syntax for revalidating a route-group layout path against current Next docs before writing this**, don't guess.
- [ ] `apps/web/src/components/shared/app-shell.tsx` — update the 4 hardcoded nav links (`/demo/dashboard`→`/dashboard`, `/demo/signups`→`/signups`, `/demo/teams`→`/teams`, `/demo/signup-templates`→`/signup-templates`); add a `headerActions?: ReactNode` prop (used by Phase 4's sign-out button) — keep `AppShell` itself auth-agnostic, `headerActions` is just a slot like `banner` already is.
- [ ] Update remaining hardcoded `/demo/...` hrefs (grep `apps/web/src/features` for `"/demo` to find current instances — as of this doc's writing: `features/dashboard/dashboard-view.tsx` ×3, `features/signup-templates/template-list-view.tsx`, `features/signup-templates/new-template-view.tsx`, `features/signup-templates/components/new-template-form.tsx`, `features/signups/signup-detail-view.tsx`, `features/signups/signups-list-view.tsx` ×2, `features/signups/new-signup-view.tsx`, `features/signups/components/new-signup-form.tsx`).
- [ ] `features/signups/actions.ts` and `lib/api/mutations.ts`'s `adminMutation()` — swap `getDemoSession()` → `getAppSession()` (**not** `requireAppSession()` — a mutation server action shouldn't `redirect()` out from under a form submit; keep returning `{ok:false, error:"no_session"}` for any non-`demo`/`authenticated` status, same failure shape as today). Update their `revalidatePath` calls to match the route-group path chosen above.
- [ ] `app/page.tsx`'s `/demo` landing link is unaffected — leave as-is.

## Phase 4 — Sign-in / Sign-up UI + Sign-out

Depends on Phase 1 (invite endpoints), Phase 2 (`createSupabaseServerClient`), Phase 3 (`/dashboard` existing as the post-auth landing target).

- [ ] `app/sign-in/page.tsx` + `app/sign-in/actions.ts` — email/password form, `supabase.auth.signInWithPassword`, redirect to `?next=` (validate it's a same-origin relative path before redirecting) or `/dashboard`. Follow the existing form pattern in `features/signups/components/new-signup-form.tsx` (`useState`/`useTransition`, `Input`/`Label`/`Button` from `components/ui`, inline `role="alert"` error text) — no new UI primitives needed.
- [ ] `app/sign-up/page.tsx` + `app/sign-up/actions.ts` — reads `?invite=` searchParam to prefill a single token field that also accepts manual entry (this one field satisfies "hand-type a URL or a code" — pasting `/sign-up?invite=CODE` prefills it, typing `CODE` directly also works). `signUp()` sequencing:
  1. Validate form input (Zod).
  2. `GET /internal/invites/:token/validate` **first** — fail fast before creating any Supabase account on a bad/expired/used token.
  3. `supabase.auth.signUp({email, password})`.
  4. `POST /internal/invites/redeem` with the returned `authId`.
  5. **Partial-failure case** (step 3 succeeded, step 4 failed — token expired/redeemed between steps 2 and 4, or a DB error): don't attempt to delete the Supabase account server-side. The user is now in exactly the `needs_org` state `requireAppSession()` already handles (Phase 2) — show a form error and offer a `retryRedeem(token)` action that re-runs step 4 only, reusing the now-authenticated session's `auth_id`/`email` instead of rebuilding rollback/cleanup logic.
- [ ] **Confirm in the Supabase project's Auth settings, not code**: the default "Confirm email" setting blocks `signUp()` from returning an active session immediately. For sign-up → land-on-dashboard to work without an email round-trip, this needs to be off for the pilot. Check this in the Supabase dashboard before testing Phase 4 — don't assume it's already off.
- [ ] `apps/web/src/lib/auth/actions.ts` (new) — `signOut()`: `createSupabaseServerClient().auth.signOut()`, then `redirect("/")`. Rendered as a small form (`<form action={signOut}>`) passed into `AppShell`'s `headerActions` slot from `app/(app)/layout.tsx`.

## Phase 5 — E2E + Doc Cleanup

- [ ] `apps/web/e2e/demo.spec.ts` / `admin.spec.ts` — update `page.goto()`/URL assertions from `/demo/dashboard` etc. to the collapsed top-level paths.
- [ ] New `apps/web/e2e/auth.spec.ts`:
  - Sign-up via a script-generated invite (Phase 1's `create-invite.ts`) → lands authenticated on `/dashboard`.
  - Unauthenticated visit to a protected route (e.g. `/teams`) redirects to `/sign-in?next=/teams`.
  - Demo flow regression: `/demo` → cookie issued → lands on `/dashboard`, banner visible, "view as" switcher still works.
  - Needs local Supabase (`supabase start`) per `TESTING.md`'s "Supabase Local for Integration Tests" section — never point E2E auth tests at the production Supabase project.
- [ ] Per the existing rule in `__docs/tasks/lessons.md` (verification belongs in durable tests, not ad hoc curl/Prisma-Studio checks) — the redemption endpoint's correctness must be proven by Supertest/Playwright before this is called done, not by manually poking it.
- [ ] Doc updates once implemented:
  - `AUTH.md` — status block: mark `SupabaseSessionResolver` implemented; update the "Where this plugs in" section to describe cookie-based dispatch as current, not future.
  - `DEMO_MODE.md` — the "current reality vs. target" caveat in the Frontend section becomes obsolete once `/demo` is genuinely a pure entry point; replace with as-built description.
  - `FRONTEND.md` — Directory Structure section: describe the `app/(app)/` tree, updated `middleware.ts` matcher description, new `app/sign-in/`/`app/sign-up/` routes.
  - `CROSSCONTEXT_TODOS.md` — mark the "Auth Session Resolution" item resolved; remove the now-stale pointer to this doc's old "not started" framing.
  - This doc — flip the status line to "implemented," check all boxes.
  - `__docs/NEXT_SESSION.md` — remove the pointer entry added when this doc was created (see below), since the doc's own status line becomes the source of truth once implementation starts.

## Verification (run at the end of every phase, not just at the very end)

- Phase 1: `pnpm --filter @vc/api test` (Supertest) — green with zero `apps/web` changes.
- Phase 2: the Edge-runtime smoke test (does `@supabase/ssr` actually run under this repo's Next config in middleware) — check this explicitly before Phase 3 starts. `pnpm --filter @vc/web test` for the resolver dispatch unit tests.
- Phase 3: `tsc --noEmit` + `next build` clean, existing Vitest/RTL suite green with updated hrefs, demo E2E flow (path-updated) still passes.
- Phase 4: manual pass — sign up via a `create-invite.ts`-generated link → lands on `/dashboard`; sign out → redirected to `/`; sign back in → back on `/dashboard`.
- Phase 5: full suite green — `pnpm --filter @vc/web test`, `pnpm --filter @vc/api test`, `pnpm --filter @vc/web exec playwright test` (needs local Supabase running), `tsc --noEmit` across affected workspaces, `next build`.

### Critical files (for quick orientation in a fresh session)

- `apps/web/src/lib/auth/session-resolver.ts`, `apps/web/src/lib/auth/demo-cookie.ts`, `apps/web/src/middleware.ts`
- `packages/db/prisma/schema.prisma`
- `apps/api/src/routes/internal.ts`, `apps/api/src/repositories/index.ts`, `apps/api/src/repositories/demo-session.ts` (pattern to mirror)
- `apps/web/src/components/shared/app-shell.tsx`
- `apps/web/src/app/demo/layout.tsx`, `apps/web/src/app/demo/dashboard/page.tsx` (patterns to mirror/move)
