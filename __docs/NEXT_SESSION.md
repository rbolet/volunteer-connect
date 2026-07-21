# Next Session

Working notes for the next session to pick up. Not a durable reference doc — clear out/fold into `CROSSCONTEXT_TODOS.md` or a feature task once acted on.

## 1. Deployed-chain verification (local chain is now covered)

The 2026-07-15 session built the BFF→Express→Supabase chain and the Playwright E2E suite exercises it fully **locally** (`pnpm test:e2e`). What remains is verifying the _deployed_ chain, which is known-broken until three env changes land (see `DEPLOYMENT.md` → Database Connection):

- Railway dashboard `DATABASE_URL` and the CI `SUPABASE_DATABASE_URL` secret must switch to the **session pooler** URL (`aws-1-us-east-2.pooler.supabase.com:5432`) — the direct `db.<ref>.supabase.co` host is IPv6-only and Railway has `ipv6EgressEnabled: false`.
- Vercel needs `DEMO_SESSION_SECRET` set (new env var for the demo cookie).
- Vercel's `API_URL` must point at the Railway service (currently only local).

Then extend `scripts/verify-deploy.mjs` (or a deployed-mode Playwright run) to drive one real request through Vercel → Railway → Supabase rather than checking each service in isolation.

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
