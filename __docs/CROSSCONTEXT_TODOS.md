# Cross-Context TODOs

Items that span multiple features or layers and need to be implemented once at the right time, not scoped to any single feature task.

---

## Prisma Middleware — Audit Fields + Soft Deletes

**Why**: All non-pivot entities carry `created_by`, `updated_by`, and `deleted_at`. Prisma has no native support for these; they must be injected via a client extension/middleware.

**What to build** (`packages/db`):

- On `create`: set `created_by` and `updated_by` from context (user_id passed via `AsyncLocalStorage` or explicit context object).
- On `update`: set `updated_by` from context.
- On `delete`: intercept and convert to an `update` setting `deleted_at = now()` (soft delete).
- On `findMany` / `findFirst` / `findUnique`: inject `WHERE deleted_at IS NULL` automatically unless caller opts out.

**Excluded** from soft-delete and audit: join/pivot tables (`OrgRole`, `TeamMembership`, `SignupEligibleRole`) — rows are replaced, not soft-deleted, and don't need audit fields.

**Approach**: Prefer a Prisma Client Extension (`$extends`) over the deprecated `$use` middleware API (deprecated as of Prisma 4.16).

**Added requirement (from `DEMO_MODE.md`)**: the extension also needs a hard-delete escape hatch — a variant that performs a real `DELETE` instead of the soft-delete conversion, scoped to a given `org_id`. The demo reset job needs this; soft-deleting on every reset would leave an ever-growing pile of `deleted_at` rows instead of a clean slate. Design the escape hatch in from the start (e.g. a context flag or a separate `$extends` variant) rather than bolting it on later.

---

## RLS Policies — Org Scoping

**Deprioritized for the pilot (2026-07-09):** speed to a working public demo takes priority over defense-in-depth at the DB layer while there's only one real org and no paying customer. `DEMO_MODE.md`'s seed script/reset job are proceeding without this. Revisit before a second real org exists, or before RLS is otherwise picked up — whichever comes first. A concrete migration + mechanism plan was drafted and set aside; ask before restarting it rather than re-deriving from scratch.

**Why** (original rationale, still valid, just not being acted on yet): `CLAUDE.md` states "Defense in depth: RLS at DB layer..." as a standing convention, but **no RLS policies exist in the current migration at all** — not even single-org scoping for the one org that exists today. This blocks both real multi-org safety and `DEMO_MODE.md`'s isolation model, which assumes the demo org is protected by the same RLS as any other org (no demo-specific carve-out).

**What to build** (`packages/db` migration + Supabase):

- `org_id = current_setting('app.org_id')`-style policies on every org-scoped table.
- A defined mechanism for setting `app.org_id` per request/transaction from the trusted BFF header (see the Trusted BFF Header item below) — likely a `SET LOCAL` at the start of each Express request's DB transaction.
- Not demo-specific — this is foundational and should be designed/built independent of demo mode, which merely depends on it existing.

---

## Auth Session Resolution

**Demo path built 2026-07-15** (`apps/web/src/lib/auth/`, `apps/web/src/middleware.ts` — see AUTH.md's updated status block for the as-built decisions). **Remaining**: `SupabaseSessionResolver` is a stub returning `null` — real `@supabase/ssr` integration, sign-in UI, and user provisioning are still to build when real-org auth is picked up.

**Also blocked on this**: the `/demo/*`-prefixed frontend route tree becoming a single shared tree (cookie-based resolver dispatch instead of path-based, `/demo` reduced to a pure entry-point redirect). `apps/web/src/features/` was already split out of `app/demo/` in the 2026-07-23 reorg so this is routing-only work when picked up.

**Planned, not started (2026-07-23 planning session)**: full scope now covers both `SupabaseSessionResolver` and the route-tree collapse together, plus a new invite-only org-assignment mechanism (`OrgInvite` — resolves the "how does a new user get an org_id" open decision in `AUTH.md`). Phased build-out with checkable progress: `__docs/plans/REAL_AUTH_IMPLEMENTATION.md`.

---

## Response/View-Model Zod Schemas

**Built 2026-07-15** for the initial demo screens: `packages/zod/src/responses.ts` (`SignupListItem`, `SignupDetail`, `TeamWithPoints`, `MyResponseView`) plus `session.ts` (`resolvedSessionSchema`, `demoSessionResponseSchema`), composed from the `*Input` building blocks per the original design. The web BFF re-validates every Express payload against them (`apps/web/src/lib/api/queries.ts`). Extend per-screen as new endpoints appear — the original guidance stands: don't reuse `*Input` schemas for responses.

---

## Deployed-Chain Verification — Automated Deep Check

**Deferred (2026-07-23):** manual testing confirmed the deployed chain (Vercel → Railway → Supabase) works — reads, writes, admin actions — but `scripts/verify-deploy.mjs` still only checks each service in isolation, with no automated version of that manual pass. A concrete plan (new gated diagnostic route in `apps/web`, a fourth `verify-deploy.mjs` check, a post-deploy CI job) was drafted and set aside — not built because it requires a new env var (`DEPLOY_CHECK_SECRET`) to track, which wasn't wanted yet. Full design: `DEPLOY_CHAIN_VERIFICATION_PLAN.md`. Ask before restarting rather than re-deriving from scratch.

---

## Trusted BFF Header — Wire Up the Forwarding Code

**Built 2026-07-15**, carrying the full `ResolvedSession` per AUTH.md:

- BFF-side: `apps/web/src/lib/api/client.ts` attaches `x-bff-secret` + `x-session` on every Express call.
- Express-side: `apps/api/src/middleware/bff-auth.ts` (`requireBffSecret` — timing-safe compare, fails closed on missing config; `requireSession` — Zod-validates the payload). Supertest coverage in `apps/api/src/__tests__/bff-auth.test.ts`.
