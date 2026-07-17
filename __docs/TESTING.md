# Volunteer Connect — Testing Reference

Load on demand. Referenced from CLAUDE.md. Not always-on.

## Stack

| Tool                                                  | Role                                              | Scope                    |
| ----------------------------------------------------- | ------------------------------------------------- | ------------------------ |
| Vitest                                                | Test runner + assertions                          | Both apps + all packages |
| React Testing Library + `@testing-library/user-event` | Component rendering + interaction                 | `apps/web`               |
| MSW (Mock Service Worker)                             | Intercept API calls in tests without real network | `apps/web`               |
| Supertest                                             | HTTP integration tests against Express router     | `apps/api`               |
| Playwright                                            | E2E — full browser, real server                   | `apps/web/e2e/`          |
| `@faker-js/faker`                                     | Deterministic test data generation                | Both apps                |

## File Layout

```
apps/
  web/
    src/
      **/__tests__/        # Component + hook unit tests (Vitest + RTL)
    e2e/                   # Playwright specs
    src/mocks/
      handlers.ts          # MSW request handlers
      server.ts            # MSW node server (used in Vitest setup)
      browser.ts           # MSW browser worker (used in dev for stubs)
  api/
    src/
      **/__tests__/        # Route integration tests (Vitest + Supertest)
packages/
  db/
    src/__tests__/         # Repository layer unit tests (Vitest + mocked Prisma client)
  zod/
    src/__tests__/         # Schema validation unit tests (Vitest)
```

## TDD Cycle

Red → Green → Refactor. Write the failing test first; no implementation without a test.

**Unit tests:** Pure logic — point totals, slot conflict detection, signup lifecycle state transitions, Zod schema validation. No DB, no network.

**Integration tests (API):** Vitest + Supertest against an in-memory Express app. Seed a real test DB (Supabase local via `supabase start`) or use a mocked Prisma client. Test: auth header forwarding, RLS-adjacent guard logic, slot claim race conditions.

**E2E (Playwright):** Full stack against local dev environment. Core flows only:

1. Signup open → volunteer claims slot → signup closes → admin finalizes → points recorded
2. Volunteer sees own teams' point totals
3. Admin creates signup, assigns slots, confirms completion

## MSW Setup (Next.js)

MSW intercepts `fetch` at the service worker level in browser and the node http module in tests. Use for all Next.js component/page tests that depend on API responses.

```ts
// apps/web/src/mocks/handlers.ts
import { http, HttpResponse } from "msw"

export const handlers = [http.get("/api/signups", () => HttpResponse.json({ signups: [] }))]
```

Vitest global setup file (`vitest.setup.ts`) starts the MSW node server before all tests and resets handlers after each test.

## Supertest Pattern (Express)

```ts
// apps/api/src/__tests__/signups.test.ts
import request from "supertest"
import { app } from "../app"

it("returns 401 when BFF header is missing", async () => {
  await request(app).get("/signups").expect(401)
})

it("returns signups for authenticated user", async () => {
  await request(app)
    .get("/signups")
    .set("x-user-id", "user-123")
    .set("x-org-id", "org-abc")
    .expect(200)
})
```

The BFF trusted-header pattern means Express integration tests verify that the `x-user-id` / `x-org-id` header guard works correctly — Express should reject requests missing this header.

## Coverage Targets

| Area                                                  | Tool        | Priority |
| ----------------------------------------------------- | ----------- | -------- |
| Point ledger calculation                              | Vitest unit | Critical |
| Slot conflict / capacity check                        | Vitest unit | Critical |
| Signup lifecycle state machine                        | Vitest unit | Critical |
| Zod schema validation edge cases                      | Vitest unit | High     |
| Express route auth guard (missing/invalid BFF header) | Supertest   | Critical |
| Slot claim (DIRECT_CLAIM) race condition              | Supertest   | High     |
| RANKED_CHOICE response submission + edit              | Supertest   | High     |
| Admin finalizes → points written to ledger            | Supertest   | High     |
| Full signup flow (E2E)                                | Playwright  | Critical |
| Point totals displayed correctly (E2E)                | Playwright  | High     |

## Local Test Commands

```bash
# From monorepo root
pnpm test                        # All unit/route/component tests (turbo)
pnpm --filter @vc/api test       # One workspace
pnpm test:e2e                    # Playwright E2E — boots (or reuses) both dev servers,
                                 # RESETS the demo org first (global-setup), runs
                                 # read-only "core" specs before mutating "admin" specs
```

Note: a pre-existing failing test in `@vc/error-utils` currently fails root `pnpm test` and cancels downstream turbo test tasks — run per-workspace filters until it's fixed.

## Seed Script / Fixtures

**Built 2026-07-15** in `packages/db/src/seed/`: hand-curated content (`demo-data.ts`, not faker) turned into rows by `generate.ts` (one transaction, resolves the content's `key` cross-references into FKs), with CLI entries `run.ts` (`pnpm --filter @vc/db db:seed`, refuses to double-seed) and `reset-demo.ts` (`db:reset-demo`, hard-wipe scoped to the demo org then reseed — see `wipe.ts`). Content-integrity tests (`src/seed/__tests__/demo-data.test.ts`) enforce that every cross-reference resolves and DB constraints (unique user+slot, capacity, team membership, role eligibility) hold before anything touches the DB.

E2E specs live in `apps/web/e2e/` (`playwright.config.ts` boots both dev servers, or reuses running ones; run via root `pnpm test:e2e`). They run against the seeded demo org and clean up their own mutations.

## Supabase Local for Integration Tests

```bash
supabase start   # Start local Supabase (Postgres + Auth + Storage)
supabase db reset --local  # Reset schema + seed data
```

Set `DATABASE_URL` in `.env.test` to the local Supabase Postgres URL. Do not use the production Supabase instance in tests.
