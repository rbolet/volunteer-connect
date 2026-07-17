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

## 3. Small cleanups queued

- Fix the pre-existing failing test in `@vc/error-utils` (`"@fetchUser: …"` vs `"fetchUser: …"` — one-char message drift); it fails root `pnpm test` and cancels downstream turbo test tasks.
- Consider a shared `argsIgnorePattern: "^_"` in the root ESLint config (currently a one-off eslint-disable in `apps/api/src/app.ts` for Express's required 4-arity error handler).
- Railway cron for the demo reset (`db:reset-demo` script is ready; plan support unverified — `DEMO_MODE.md`).
