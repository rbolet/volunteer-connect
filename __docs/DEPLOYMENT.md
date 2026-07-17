# Deployment & CI/CD

Load on demand. Referenced from CLAUDE.md. Not always-on.

## Pipeline

`.github/workflows/deploy.yml`, triggered on push to `main`:

```
test (turbo lint → typecheck → test)
  ├─ migrate-db (prisma migrate deploy against Supabase)
  │    ├─ deploy-api (Railway)
  │    └─ deploy-web (Vercel)
  └─ api-image-smoke-test (builds apps/api Docker image, boots it, curls /health)
       └─ deploy-api (Railway)
```

`deploy-api` needs both `migrate-db` and `api-image-smoke-test`. `deploy-web` only needs `migrate-db`. The smoke-test job exists because `railway up --detach` (used by `deploy-api`) fires the deploy and returns immediately without waiting to confirm it actually booted — a broken Dockerfile or missing runtime dependency would otherwise only surface after a real Railway deploy, not in CI.

## Required GitHub Repo Secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret                                | Source                                                                                                                                                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_DATABASE_URL`               | Supabase dashboard → Project Settings → Database → Connection string — **session pooler, port 5432** (see "Database Connection" below: the direct host is IPv6-only and unreachable from IPv4 runners; the transaction pooler on 6543 can't do DDL) |
| `RAILWAY_TOKEN`                       | Railway dashboard → Project Settings → Tokens                                                                                                                                                                                                       |
| `RAILWAY_SERVICE_ID`                  | Railway dashboard → `api` service → Settings → Service ID (or its name)                                                                                                                                                                             |
| `VERCEL_TOKEN`                        | Vercel dashboard → Account Settings → Tokens                                                                                                                                                                                                        |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | Run `vercel link` locally in `apps/web` — writes `.vercel/project.json` with both                                                                                                                                                                   |

## Prerequisites (provisioned externally, not by this repo)

- Vercel project linked to this repo, root directory `apps/web`
- Railway project with a service for `apps/api` (already has a `Dockerfile`, which Railway builds from)
- The Supabase project itself
- **Railway free tier**: deploys can be time-restricted (encountered a "can't deploy until after 8pm" limit this session) — not a bug, just the plan's constraint

## Railway Config (`railway.json`)

Repo root `railway.json` is the source of truth for the `apps/api` Railway service's build/deploy settings, not the dashboard — the dashboard UI has silently failed to persist cleared fields in this project (a "Custom Start/Build Command" kept applying after being blanked out in the UI). Notes:

- `startCommand` / `buildCommand` are deliberately **omitted** so the Dockerfile's own `CMD`/`RUN` steps stay authoritative. Do not add either back without a strong reason — a stray `startCommand` overriding `CMD` is exactly what caused a prior outage (see git history around the Railway 502 debugging if the details are needed).
- `build.watchPatterns` must include every path the Dockerfile actually depends on, not just `apps/api/**` — it also depends on `packages/db|types|zod`, root `pnpm-lock.yaml`/`pnpm-workspace.yaml`/`package.json`/`tsconfig.base.json`, and `railway.json` itself (so edits to this file trigger a redeploy).
- `deploy.healthcheckPath` is `/health` (matches the Express route in `apps/api/src/app.ts`).
- `PORT` is intentionally **not** set here — kept as a Railway dashboard-only environment variable (pinned to `4000`, matching the Dockerfile's `EXPOSE 4000` and the public domain's Networking target port). Railway auto-injects its own dynamic `PORT` if none is set; since the app does `process.env.PORT ?? 4000`, an unpinned `PORT` can drift out of sync with whatever target port the public domain is configured to proxy to, causing the app to be healthy internally but unreachable externally (`connection refused` from Railway's edge). Pinning it removes that failure mode.

## Database Connection — Session Pooler, Not the Direct Host (2026-07-15)

Supabase's direct connection host (`db.<ref>.supabase.co:5432`) is **IPv6-only**. Any IPv4-only network (this dev machine; Railway with `ipv6EgressEnabled: false` in `railway.json`) cannot reach it at all — `Can't reach database server`, no answer for the A record. Use the **session pooler** URL instead, which is IPv4-compatible and supports DDL/migrations (session mode, port 5432):

```
postgresql://postgres.<ref>:<password>@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

Local `packages/db/.env` / `apps/api/.env` now use this. **Flag for deploy time:** the Railway dashboard's `DATABASE_URL` and the CI `SUPABASE_DATABASE_URL` secret likely still hold the direct URL — they must be switched to the pooler URL (or Railway's IPv6 egress enabled) before the api can query the DB in production; nothing queried the DB at runtime before this session, so this was never exercised. Session pooler on **5432** is fine for migrations/DDL; it's the **transaction** pooler on 6543 that isn't.

## Docker + pnpm Monorepo Layout

`apps/api/Dockerfile` runs the app **from TypeScript source via tsx** (decided 2026-07-15): workspace packages (`@vc/db`, `@vc/zod`, …) export `src/*.ts` directly, which a plain `node dist/` runtime can't resolve — tsx gives dev, vitest, and prod one uniform resolution path. The build stage's gate is `prisma generate` (runtime requirement) + `tsc --noEmit`; no JS is emitted or shipped. Things that aren't obvious from reading it alone:

- Any tsconfig that `extends` a root-level file (`apps/api/tsconfig.json` → `../../tsconfig.base.json`) needs that root file explicitly `COPY`'d into the build context — it isn't pulled in implicitly.
- pnpm's strict linking puts each workspace's production dependencies as symlinks under **that workspace's own** `node_modules` (e.g. `apps/api/node_modules/express -> ../../../node_modules/.pnpm/...`), not hoisted to the repo-root `node_modules`. The final `runner` stage must therefore preserve the `apps/api/` directory structure and copy both `node_modules` (root) and `apps/api/node_modules`, not flatten `dist` + root `node_modules` alone — otherwise the container builds and boots but crashes on the first `require()` of any workspace-scoped dependency.

## One-Time Migration Bootstrap

Before CI's `migrate-db` job can just apply deltas, the initial migration has to be applied manually once:

```bash
pnpm --filter @vc/db migrate:deploy
```

Prisma auto-loads `DATABASE_URL` from `packages/db/.env` (pointed at the real Supabase connection string) when the command runs with that package as cwd — no need to pass it inline once `.env` is set.

## Environment Files

All real `.env` files are gitignored (bare `.env` pattern in `.gitignore` matches at any depth).

| File                    | Holds                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/.env`         | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `API_URL`, `TRUSTED_BFF_SECRET`, `DEMO_SESSION_SECRET` |
| `apps/api/.env`         | `PORT`, `DATABASE_URL`, `SUPABASE_SECRET_KEY`, `TRUSTED_BFF_SECRET`                                                        |
| `packages/db/.env`      | `DATABASE_URL` (used by Prisma CLI directly)                                                                               |
| `.env` (repo root, new) | `DEPLOY_WEB_URL`, `DEPLOY_API_URL` — used only by `scripts/verify-deploy.mjs`. Copy from `.env.example`.                   |

`TRUSTED_BFF_SECRET` is set in both `apps/web/.env` and `apps/api/.env` (same value) for the BFF trusted-header pattern — forwarding code built 2026-07-15 (`apps/web/src/lib/api/client.ts` ↔ `apps/api/src/middleware/bff-auth.ts`). `DEMO_SESSION_SECRET` (web only) signs the demo identity cookie and must also be set in Vercel before the demo works when deployed.

**Deployed environments** (Vercel/Railway dashboards) need their own copies of the relevant keys set as environment variables — local `.env` files aren't read at runtime there.

## Supabase API Keys

This project uses Supabase's newer **Publishable**/**Secret** key system (`sb_publishable_...` / `sb_secret_...`), not the legacy `anon`/`service_role` JWT keys — Supabase recommends the new keys for new projects, and no consuming code existed yet when this was decided, so there was no migration cost. Functionally a drop-in replacement for `createClient(url, key)` in `@supabase/supabase-js` / `@supabase/ssr`.

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (web) — replaces `anon`
- `SUPABASE_SECRET_KEY` (api) — replaces `service_role`

Get both from Supabase dashboard → Project Settings → API Keys (the new keys section, not the legacy one).

## Pre-Commit Hook

`.husky/pre-commit` runs, in order:

1. `pnpm exec lint-staged` — Prettier + ESLint `--fix` on staged files only (config in root `package.json`'s `"lint-staged"` key)
2. `pnpm typecheck` — whole-project via turbo, but cached per-workspace, so untouched packages are a cache hit (~7ms) rather than a full re-check

Bypass with `git commit --no-verify`.

## Deployment Verification Script

`scripts/verify-deploy.mjs` (`pnpm verify:deploy`) — dependency-free Node script (Node 22 native `fetch`), checks all three services independently so one failure doesn't block the others from reporting:

- **Vercel**: GETs `DEPLOY_WEB_URL`, follows the `/` → `/health` redirect, confirms the health page actually rendered
- **Railway**: GETs `${DEPLOY_API_URL}/health`, confirms `{"status":"ok"}`
- **Supabase**: queries the `organizations` table via PostgREST with the publishable key — confirms both reachability and that the migration was actually applied

Reads `DEPLOY_WEB_URL`/`DEPLOY_API_URL` from the root `.env` if not passed inline. Exits non-zero if anything failed; not wired into CI or the pre-commit hook.

## Known Open Items (as of 2026-07-09)

- All three services (Vercel, Railway, Supabase) are deployed and passing `pnpm verify:deploy`.
- Supabase: hit a transient `PGRST002` ("could not query the database for the schema cache") 503 at one point. If this recurs, check the dashboard's project status (paused / restoring) before assuming a real bug — free-tier Supabase projects pause on inactivity same as Railway.
- `api-image-smoke-test` (CI) build/boots the Docker image but doesn't yet exercise it the same way local dev would — see `__docs/NEXT_SESSION.md` for the plan to use Docker locally as the dev environment for `apps/api`.
- Cross-service connectivity (Vercel → Railway BFF calls, Railway → Supabase) has only been verified via each service's own `/health`/reachability check independently, not an actual end-to-end request through the real BFF path — see `__docs/NEXT_SESSION.md`.
