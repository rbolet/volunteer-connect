# Demo Mode

Load on demand. Referenced from CLAUDE.md.

**Status: proposed design.** Written before the first real pilot org exists, so this is meant to be the foundation prod multi-org support builds on, not a fork of it. It depends on two pieces of architecture that don't exist yet — [AUTH.md](AUTH.md)'s session resolver and baseline RLS policies (`CROSSCONTEXT_TODOS.md`) — and is written as a forward-looking spec against them rather than an as-built reference.

**Deliberate deviation (2026-07-09): RLS is deferred for the initial pilot demo.** Speed to a working public demo currently outweighs defense-in-depth at the DB layer — there's only one real org and no paying customer yet, so org-scoping bugs have no victim. The seed script and reset job are being built now, against app-layer isolation only (whatever the not-yet-built Express/BFF layer enforces), not real RLS. This is an accepted, temporary gap, not a silent one: revisit before either (a) RLS is later added — the demo becomes the natural test that it doesn't break org isolation, or (b) a second real org/paying customer exists, whichever comes first. Don't let this doc's original "don't build ahead of RLS" framing below read as still-current — it described the ideal sequencing, not the one actually being followed right now.

## Principle

Demo is not a separate system. It is one `Organization` row, seeded with realistic data, reached through a dedicated entry point and a password-less auth resolver. Every model, RLS policy, and business rule that applies to a real org applies to the demo org unchanged. If something needs a demo-only code path outside of the entry route, seed script, and reset job, that's a signal the org-scoping abstraction has a hole — the same hole would bite a second real customer.

## Schema change

Add one field to `Organization` (`packages/db/prisma/schema.prisma`):

```prisma
model Organization {
  id         String    @id @default(cuid())
  name       String
  is_demo    Boolean   @default(false)
  // ...existing fields
}
```

- `is_demo` is how the reset job and `DemoSessionResolver` find "the" demo org, rather than hardcoding a magic cuid in multiple places. Read it via a query (`findFirst({ where: { is_demo: true } })`) at startup/deploy time to resolve `DEMO_ORG_ID`, or set `DEMO_ORG_ID` as an env var once the seed script creates the row and keep `is_demo` as a human-readable/query-friendly marker. Either works; pick one source of truth and don't let both drift.
- **Open decision:** whether to enforce "at most one demo org" at the DB level. Prisma doesn't support partial unique indexes directly — it would need a raw-SQL addition to the migration (`CREATE UNIQUE INDEX ... WHERE is_demo`). Not blocking today (only one will ever be created manually), but worth doing before this becomes a self-serve or multi-environment setup.

## Auth

Demo sessions are issued by `DemoSessionResolver` (defined in [AUTH.md](AUTH.md#demosessionresolver)), dispatched purely by route (`/demo/*`) in Next.js middleware — never by a client-set flag, request body field, or query param. See AUTH.md for the interface and the specific reasons the demo `org_id` must come from server env, not the request.

Seeded demo users (see seed script below) — one per `TeamRole` (`head_coach`, `coach`, `referee`, `volunteer`) plus one `OrgRole: admin` — are the fixed set `DemoSessionResolver` is allowed to impersonate. The "view as Admin / Coach / Referee / Volunteer" switcher in the frontend posts to a server action that re-issues the signed demo cookie for a different (still fixed, still enum-validated) seeded user id. It never creates a session for an arbitrary id.

## RLS

No demo-specific RLS policies. Once baseline org-scoped RLS exists (blocked — see `CROSSCONTEXT_TODOS.md`), the demo org is isolated by exactly the same `org_id = current_setting('app.org_id')` policies as any other org. This is deliberate: demo traffic hitting the same RLS as prod is the cheapest possible continuous test that org-scoping actually holds, before a second paying customer's data is ever at stake. Do not add an `OR org.is_demo` exception anywhere in policy definitions — that would carve out exactly the kind of special case this design is trying to avoid.

## Seed script

**Status: doesn't exist yet.** No `prisma/seed.ts`, no `"prisma": {"seed": ...}` entry in `packages/db/package.json`, and `faker-js` (referenced in `TESTING.md` as the intended test-data tool) isn't installed in any workspace yet. This section designs it before writing it so it isn't built three times for three consumers.

### Location

`packages/db/src/seed/` — a set of composable builder functions, not a single monolithic script:

```
packages/db/src/seed/
  builders.ts     # seedOrg(), seedSeason(), seedTeamsAndMemberships(), seedSignup(mode), seedSlotResponses(), seedPointsLedger()
  scenario.ts      # composes builders into one realistic org (the "demo dataset")
  run.ts           # CLI entry: `prisma db seed` calls this for local dev bootstrap
```

Builders take an explicit `org_id` and a Prisma client (or transaction client) as arguments — no hidden global state — so the same functions work whether the caller wants one full org's worth of data or a single row for a unit test.

### Three consumers

1. **Local dev bootstrap** — `pnpm --filter @vc/db exec prisma db seed` (wire `run.ts` as the `package.json` `"prisma": {"seed": "tsx src/seed/run.ts"}` entry) calls `scenario.ts` against whatever `DATABASE_URL` is active (local Supabase). Produces one full org: a season, teams with memberships across all `TeamRole`s, at least one `RANKED_CHOICE` signup and one `DIRECT_CLAIM` signup each with slots and responses in a mix of statuses, and some finalized `PointsLedger` rows so point totals aren't empty on first load.
2. **Demo reset** — the reset job (below) calls the same `scenario.ts`, but first hard-deletes every row scoped to `DEMO_ORG_ID` (see reset job section for why this can't be the normal soft-delete path), then reseeds fresh. Same builders, same shape of data, just scoped and destructive-then-rebuilt instead of additive.
3. **Test fixtures** — Vitest/Supertest tests (`TESTING.md`) import individual builders directly (`seedTeamsAndMemberships`, not the whole `scenario.ts`) to construct the minimal data a given test needs, against the local test DB. This replaces ad hoc per-test fixture creation with the same functions the demo relies on, so a builder bug surfaces in unit tests before it corrupts the public demo.

### Determinism

Use `faker` with a fixed seed (`faker.seed(42)`) in `scenario.ts` so the demo dataset is stable and reviewable (names, dates, team names don't change on every reseed) — important since people will link to this deployment and screenshots/walkthroughs shouldn't go stale-looking after a reset. Test fixtures can use unseeded faker or explicit literals, since determinism there matters less than in the public-facing dataset.

## Reset job

### What "wipe" means here, and why it's not just calling `.delete()`

The planned Prisma client extension (`CROSSCONTEXT_TODOS.md` → Prisma Middleware) intercepts `delete` and converts it to a soft-delete update (`deleted_at = now()`). That's correct for real orgs, where retention matters. It's wrong for the demo reset: soft-deleting on every reset would leave an ever-growing pile of `deleted_at`-stamped rows scoped to the demo org, and — because `findMany`/`findFirst` auto-filter `deleted_at IS NULL` — a naive reseed would just add new rows on top rather than actually reclaiming a clean slate for anything that queries without the soft-delete filter (audits, admin "show deleted" views, direct SQL).

**This means the Prisma middleware design needs an explicit hard-delete escape hatch** (e.g. a context flag or a separate `prisma.$extends` variant used only by the reset job) that performs a real `DELETE FROM ... WHERE org_id = $1`, scoped to `DEMO_ORG_ID`, in dependency order (or via `ON DELETE CASCADE` if the schema is updated to support it — currently FKs don't specify cascade behavior). Flagging this now so it's built into the middleware from the start rather than bolted on once the reset job needs it. Add this to the `CROSSCONTEXT_TODOS.md` middleware item.

### Scheduling mechanism: Railway cron vs. Supabase `pg_cron`

|                                      | Railway cron                                                                                           | Supabase `pg_cron`                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code reuse                           | Runs a TS script in the same Node runtime, same monorepo, imports `packages/db` seed builders directly | SQL-only (or SQL calling a Supabase Edge Function via `pg_net`) — the wipe+reseed logic would have to be reimplemented in SQL or duplicated in a second Deno runtime |
| Fits "maximize shared code" priority | Yes                                                                                                    | No — fragments the one thing (seed builders) this doc is trying to keep singular                                                                                     |

**Recommendation: Railway cron job**, running a script (`packages/db/src/seed/reset-demo.ts`) that calls the hard-delete escape hatch then `scenario.ts`, on a schedule. This keeps the reset job in the same language and package as the seed script it depends on.

**Interval:** proposed nightly (e.g. 03:00 in the org's primary timezone — low traffic, gives same-day demo visitors a full day of accumulated changes before reset, which is arguably part of the demo experience). Make the cron expression configurable rather than hardcoded, in case usage patterns suggest a different cadence later.

**Open decision, unverified:** whether Railway's current plan (already flagged in `DEPLOYMENT.md` as free-tier, with deploy-time restrictions encountered) supports scheduled/cron services at all, or requires a plan upgrade. Confirm in the Railway dashboard before committing to this design over `pg_cron`.

## Frontend

- `/demo` route (`apps/web/src/app/demo/`) is a dedicated entry point, not a query param or toggle on the normal sign-in page. Hitting it (or any `/demo/*` path) triggers `DemoSessionResolver` per the middleware dispatch in AUTH.md, sets the signed demo cookie, and redirects into the normal app shell (`/dashboard` or equivalent) — no signup form, no credential prompt.
- **"View as" switcher**: a small control (visible only when `session.source === "demo"`) that posts to a server action re-issuing the demo cookie for a different seeded user, restricted to the fixed enum of demo user ids for that org.
- **Banner**: driven by `session.source === "demo"` read from the resolved session (attached via middleware/BFF, not client state) in the root layout — one check, one place. Business components never branch on demo-ness; they only ever see `org_id` and roles, same as for a real org.
- No `if (isDemo)` conditionals should appear anywhere below the layout/banner and the `/demo` entry route. If a feature needs demo-specific behavior beyond "show a banner" and "land here without logging in," that's a sign the feature is leaking the demo/prod boundary somewhere it shouldn't.

## Deployment

Single instance, unchanged from `DEPLOYMENT.md`: one Express API (Railway), one Supabase project, one Vercel frontend. Demo and prod orgs are differentiated by `org_id` alone, not by separate infrastructure. If public demo traffic ever measurably degrades prod performance (shared Postgres, shared Express process), the escape hatches — in rough order of effort — are: a read replica for demo-heavy queries, a separate Railway service instance behind the same codebase, or a fully separate Supabase project. None of this is needed at current (near-zero) traffic and shouldn't be built preemptively.

## Open decisions / flags (not silently resolved)

- **Blocked on AUTH.md and baseline RLS**, both currently undesigned-in-code. This doc's demo-specific pieces (seed script, reset job) can be built once those land; the seed script's data model doesn't depend on them and could reasonably be built first.
- **Tension with CLAUDE.md's stated MVP scope** ("MVP scope: solo accounts, no billing. Don't build org billing/multi-tenancy.") — demo mode requires a second `Organization` row to exist and be reachable, which is a form of multi-org operation even without billing or self-service org creation. Recommend clarifying that line to distinguish "a second, hardcoded demo org is in scope" from "self-service multi-tenant org creation is not" — proposed edit included below, flagged for approval rather than made silently.
- **Whether seeded demo users are one-per-role (recommended above) or a single admin identity with a UI-only "view" simulation** that doesn't change the underlying session/RLS context. One-per-role is more expensive to seed and maintain but is the only version that actually exercises RLS per role — a UI-only simulation would demo the _look_ of each role's view without validating that RLS actually restricts it, which undercuts the stated goal (demo doubles as org-scoping validation).
- **Whether to enforce "exactly one demo org" at the DB level** now (raw-SQL partial unique index) or defer it — see Schema section.
- **Hard-delete escape hatch is a new requirement on the not-yet-built Prisma middleware** — needs to be reflected in `CROSSCONTEXT_TODOS.md`'s middleware spec before that work is picked up, not discovered mid-implementation.
