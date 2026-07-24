# Next Session

Working notes for the next session to pick up. Not a durable reference doc — clear out/fold into `CROSSCONTEXT_TODOS.md` or a feature task once acted on.

## 0. Real auth + route-tree collapse — active, phased build-out (2026-07-23 planning)

Planned in full (schema, Express endpoints, resolver, middleware, route tree, sign-in/sign-up UI) but **not started**. This is the next big feature thread. Pick up at `__docs/plans/REAL_AUTH_IMPLEMENTATION.md` — it's written to be resumable from a clean session: read its Decisions section first (org assignment = invite-only, human-readable invite tokens, real users default to plain non-admin members, both the auth work and the route-tree collapse are one effort), then start at Phase 1 (schema + Express, no UI, independently testable) and work down. Check off items in that doc as they land; remove this entry once Phase 1 is underway (the doc's own status line is the source of truth from then on).

## 1. Deployed-chain verification (manually confirmed 2026-07-23; automated version deferred)

The three env changes flagged in the 2026-07-15 session (Railway/CI pooler URL, Vercel `DEMO_SESSION_SECRET`, Vercel `API_URL`) are live and correct — confirmed 2026-07-23 by manually exercising the deployed app: reads (DB-backed views), writes (claim/withdraw), and admin actions (role switching) all check out against the real Vercel → Railway → Supabase chain.

`scripts/verify-deploy.mjs` still only checks each service in isolation (Vercel health redirect, Railway `/health`, Supabase via PostgREST) — no automated version of the manual check above exists. A concrete plan to close that gap was drafted 2026-07-23 and **deliberately deferred** (it needs a new `DEPLOY_CHECK_SECRET` env var, which wasn't wanted yet) — see `CROSSCONTEXT_TODOS.md` → "Deployed-Chain Verification" and the full design in `DEPLOY_CHAIN_VERIFICATION_PLAN.md`. Not actively queued for next session; pick up only if/when the env-var tradeoff is revisited.

## 2. Docker as local dev environment for `apps/api`

Still open from 2026-07-09, with new context: the Dockerfile now runs from TS source via tsx and requires `prisma generate` in the build (see `DEPLOYMENT.md`). The CI `api-image-smoke-test` covers boot, but a local `docker build`/`run` script would catch image issues (e.g. the `packages/logger` COPY added this session) before push.

## 3. Better error observability (BFF ↔ API)

Surfaced 2026-07-20 debugging a demo 500: `ApiError` (`apps/web/src/lib/api/client.ts`) carries only `status`/`code`, no request path, so Vercel logs read as a bare `API 500: internal_error` with no way to tell which endpoint failed. Express's catch-all handler (`apps/api/src/app.ts`) logs the real message server-side but always returns the same flat `internal_error` code regardless of cause, so a DB-unreachable failure and a genuine bug are indistinguishable from the client/Vercel-log side — had to go pull raw Railway logs to find the actual Prisma error.

- Include the request path (and method) in `ApiError`'s message/log so a Vercel log line alone identifies the failing endpoint.
- Give Express's error handler a few distinct failure-class codes (e.g. `db_unavailable` vs `internal_error`) instead of one catch-all, so the BFF/log line hints at cause without leaking internals.
- Add an env-gated verbose-error toggle on the API (e.g. `VERBOSE_ERRORS=1`) that, only when set, includes the upstream error message/detail in the JSON response for troubleshooting — must default to **off** (failure-class code only) so production doesn't leak internals by default; intended for temporary use while debugging a deployed environment, not left on.
- Optional: a shared request-id generated in `apiFetch`, sent as a header, echoed in Express's log line — lets the same request be grepped across both Vercel and Railway logs.

## 4. Small cleanups queued

- Consider a shared `argsIgnorePattern: "^_"` in the root ESLint config (currently a one-off eslint-disable in `apps/api/src/app.ts` for Express's required 4-arity error handler).
- Railway cron for the demo reset (`db:reset-demo` script is ready; plan support unverified — `DEMO_MODE.md`).
