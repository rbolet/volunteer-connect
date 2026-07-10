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

**Why**: `CLAUDE.md` states "Defense in depth: RLS at DB layer..." as a standing convention, but **no RLS policies exist in the current migration at all** — not even single-org scoping for the one org that exists today. This blocks both real multi-org safety and `DEMO_MODE.md`'s isolation model, which assumes the demo org is protected by the same RLS as any other org (no demo-specific carve-out).

**What to build** (`packages/db` migration + Supabase):

- `org_id = current_setting('app.org_id')`-style policies on every org-scoped table.
- A defined mechanism for setting `app.org_id` per request/transaction from the trusted BFF header (see the Trusted BFF Header item below) — likely a `SET LOCAL` at the start of each Express request's DB transaction.
- Not demo-specific — this is foundational and should be designed/built independent of demo mode, which merely depends on it existing.

---

## Auth Session Resolution

**Why**: No auth code exists yet — no `@supabase/ssr` integration, no session handling, no Next.js middleware. `AUTH.md` proposes a `SessionResolver` interface (Supabase-backed and demo-backed implementations) so this gets built with an adapter boundary from day one, rather than hardcoding Supabase and retrofitting demo mode's password-less path later.

**What to build**: see `AUTH.md` for the full interface, session shape, and both resolver implementations. This blocks `DEMO_MODE.md`'s auth section and the Trusted BFF Header item below (the header payload should carry `AUTH.md`'s `ResolvedSession` shape, not an ad hoc pair).

---

## Trusted BFF Header — Wire Up the Forwarding Code

**Why**: `TRUSTED_BFF_SECRET` is now set in both `apps/web/.env` and `apps/api/.env`, but the actual code that forwards the trusted header (Next.js API routes → Express, per the architecture's defense-in-depth pattern) doesn't exist yet. Spans both apps, not scoped to one feature.

**What to build**:

- BFF-side (`apps/web`): code that attaches `TRUSTED_BFF_SECRET` plus the validated `user_id`/`org_id` as an outgoing header on requests to Express. Should carry `AUTH.md`'s full `ResolvedSession` shape (roles included), not just the id pair, so Express doesn't need a second lookup.
- Express-side (`apps/api`): middleware that validates the header and rejects requests where it's missing or mismatched.
