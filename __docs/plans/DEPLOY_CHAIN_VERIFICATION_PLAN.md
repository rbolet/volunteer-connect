# Deploy Chain Verification — Drafted Plan (Deferred)

**Status**: designed 2026-07-23, deliberately not built yet — needs new env vars the user didn't want to add at the time. See `CROSSCONTEXT_TODOS.md` for the one-line pointer. Read this doc in full before restarting rather than re-deriving from scratch.

## Problem

Manual testing (2026-07-23) confirmed the deployed chain (Vercel → Railway → Supabase) works end-to-end — reads, writes, and admin actions. `scripts/verify-deploy.mjs` still only checks each of the three services in isolation (health endpoint / PostgREST reachability), so it would not have caught the kind of cross-service wiring bug that the earlier manual pass was needed to rule out, and there's no automated version of that manual check.

The hard part: a script running outside the app can't easily replicate the demo auth flow. `apps/web/src/middleware.ts` signs an HMAC demo cookie; `apps/web/src/lib/auth/session-resolver.ts` exchanges it for a `ResolvedSession` via Express's BFF-secret-gated `/internal/demo-session`; every subsequent Express call carries that session as a trusted header (`apps/web/src/lib/api/client.ts`'s `apiFetch`). Reimplementing that protocol inside `verify-deploy.mjs` would duplicate business logic and drift out of sync with the real code. The plan instead adds a small **server-side diagnostic route inside the Next.js app** that reuses the existing session-resolution and query/action code paths directly, and has the external script simply call that one endpoint.

## 1. New diagnostic route: `apps/web/src/app/api/deploy-check/route.ts`

A `GET` Route Handler, gated by a new secret (`DEPLOY_CHECK_SECRET`) checked against an `x-deploy-check-secret` header — fails closed (503) if the env var isn't set, 401 if the header doesn't match. This mirrors the fail-closed pattern already used in `middleware.ts` for `DEMO_SESSION_SECRET`.

On success it performs one real, reversible round trip through the existing chain, reusing existing library code (no new business logic):

1. `apiFetch("/internal/demo-session?identity=volunteer")` → parse with `demoSessionResponseSchema` (same call `getDemoSession()` makes) to get a `ResolvedSession`.
2. `getSignups(session)` (`apps/web/src/lib/api/queries.ts`) → find the first `status === "open"` signup with `claimedSeats < totalSeats`.
3. `getSignupDetail(session, signup.id)` → find the first slot with `claimedCount < capacity`.
4. Claim: `apiFetch(`/slots/${slotId}/responses`, { method: "POST", session, body: { teamId } })` using `session.team_roles[0].team_id`. Confirmed response shape from `apps/api/src/routes/slots.ts`: `res.status(201).json({ id: result.responseId })`.
5. Withdraw: `apiFetch(`/slot-responses/${id}`, { method: "DELETE", session })` to undo the claim.

Withdraw runs in a `finally`-style guard once step 4 succeeds, so a failure in a later step still cleans up rather than leaving an orphaned claim on real demo data. Respond `200 { ok: true, steps: [...] }` on full success, or `500 { ok: false, step, error }` identifying which step failed — including a distinct `no_open_slot_available` outcome if step 2/3 finds nothing.

**Demo seed data note** (confirmed in `packages/db/src/seed/demo-data.ts`): as of this writing there is exactly **one** seeded open signup — "Referee Tent Duty — Saturday" (`ref_tent`, `DIRECT_CLAIM`, `eligibleRoles` includes `volunteer`, 8 slots × capacity 2). The other two seeded signups ("Field Lining & Setup", "Board Tent Duty") are `finalized` (terminal, unclaimable). The `volunteer` demo identity (Sam Rodriguez) is seeded with a single team membership on `eagles` as `volunteer` — satisfies the claim eligibility check in `apps/api/src/lib/claim-rules.ts` (`evaluateClaim`: role must be in `signup.eligibleRoles`, and `teamId` must match one of the session's `team_roles`). If seed data changes such that no signup is open, the route's `no_open_slot_available` outcome is itself a meaningful signal, not just a thing to ignore.

Follow the existing `apps/web/src/app/health/page.tsx` convention: wrap the chain call with `introspect` from `@vc/error-utils` and log via `@vc/logger`. Set `export const dynamic = "force-dynamic"` (no caching — matches `apiFetch`'s own `cache: "no-store"`).

## 2. Test for the new route

`apps/web/src/app/api/deploy-check/__tests__/route.test.ts` — Vitest + MSW (the project's established pattern for mocking Express responses in web tests per `TESTING.md`). Cases:

- Missing/wrong `x-deploy-check-secret` → 401; missing env var → 503.
- Happy path → 200, and MSW handlers assert both the POST claim and the DELETE withdraw were actually called (proves cleanup, not just success).
- A failure forced after the claim step still triggers the withdraw call.

## 3. Extend `scripts/verify-deploy.mjs`

Add a fourth independent `check()`: **"Deployed chain (Vercel → Railway → Supabase)"** — `GET ${WEB_URL}/api/deploy-check` with the `x-deploy-check-secret` header set from `DEPLOY_CHECK_SECRET` (read from `process.env` / root `.env`, same pattern as the existing three vars). Assert `ok: true`, surface the `steps` array in the pass detail. Update the file's header comment to mention the new check.

## 4. Wire into CI: `.github/workflows/deploy.yml`

New job `verify-deploy`, `needs: [deploy-api, deploy-web]` (runs after both are live — necessarily _after_ deploy, unlike `api-image-smoke-test` which gates _before_, since it needs real deployed URLs):

```yaml
verify-deploy:
  needs: [deploy-api, deploy-web]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    - run: node scripts/verify-deploy.mjs
      env:
        DEPLOY_WEB_URL: ${{ vars.DEPLOY_WEB_URL }}
        DEPLOY_API_URL: ${{ vars.DEPLOY_API_URL }}
        NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}
        DEPLOY_CHECK_SECRET: ${{ secrets.DEPLOY_CHECK_SECRET }}
```

No `pnpm install` needed — `verify-deploy.mjs` is dependency-free (plain Node `fetch`), so a bare `node scripts/verify-deploy.mjs` is enough.

A failure here fails the workflow (visible red X — notifications could be wired later) but doesn't roll back the already-completed deploy; there's no rollback mechanism in this pipeline today, so this is a fast-signal smoke test, not a release gate.

**Manual, non-scriptable setup a future session will need**:

- Generate a `DEPLOY_CHECK_SECRET` value and set it in the Vercel dashboard's production env vars.
- Add GitHub repo secrets/variables: `DEPLOY_CHECK_SECRET` (secret), `DEPLOY_WEB_URL` / `DEPLOY_API_URL` / `NEXT_PUBLIC_SUPABASE_URL` (variables — not sensitive), `SUPABASE_PUBLISHABLE_KEY` (secret or variable — already a client-exposed key, either works).

This new env var is exactly what made the user pause and defer the work — worth confirming it's actually wanted before restarting, not just resuming from step 1.

## 5. Docs to update once built

- `__docs/DEPLOYMENT.md`: add `DEPLOY_CHECK_SECRET` to the env files table (`apps/web/.env`) and the GitHub Repo Secrets table; update "Deployment Verification Script" to describe the fourth check; update the "Known Open Items" line about cross-service connectivity only being checked in isolation.
- `__docs/CROSSCONTEXT_TODOS.md`: remove/resolve the entry once shipped.
- Session log: note in the relevant `__docs/sessions/YYYY-MM-DD.md` when this actually gets built.

## Verification (once built)

- `pnpm --filter web test` — new route test passes (secret gating, happy-path cleanup, failure-path cleanup).
- `pnpm --filter web typecheck` / `pnpm lint` clean.
- Local manual run: `DEPLOY_CHECK_SECRET=... pnpm verify:deploy` against the real deployed URLs once the secret is set in Vercel — confirms the fourth check passes for real, not just against mocks.
- Don't test the CI job by pushing to `main` as a side effect of unrelated work — that triggers a real deploy. Exercise it on the next actual deploy instead.
