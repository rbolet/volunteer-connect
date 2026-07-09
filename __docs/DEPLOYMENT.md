# Deployment & CI/CD

Load on demand. Referenced from CLAUDE.md. Not always-on.

## Pipeline

`.github/workflows/deploy.yml`, triggered on push to `main`:

```
test (turbo lint → typecheck → test)
  └─ migrate-db (prisma migrate deploy against Supabase)
       ├─ deploy-api (Railway)
       └─ deploy-web (Vercel)
```

`deploy-api` and `deploy-web` run in parallel once `migrate-db` succeeds — no ordering dependency between them.

## Required GitHub Repo Secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret                                | Source                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_DATABASE_URL`               | Supabase dashboard → Project Settings → Database → Connection string (**direct**, port 5432, not the pooled 6543 one — DDL needs the direct connection) |
| `RAILWAY_TOKEN`                       | Railway dashboard → Project Settings → Tokens                                                                                                           |
| `RAILWAY_SERVICE_ID`                  | Railway dashboard → `api` service → Settings → Service ID (or its name)                                                                                 |
| `VERCEL_TOKEN`                        | Vercel dashboard → Account Settings → Tokens                                                                                                            |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | Run `vercel link` locally in `apps/web` — writes `.vercel/project.json` with both                                                                       |

## Prerequisites (provisioned externally, not by this repo)

- Vercel project linked to this repo, root directory `apps/web`
- Railway project with a service for `apps/api` (already has a `Dockerfile`, which Railway builds from)
- The Supabase project itself
- **Railway free tier**: deploys can be time-restricted (encountered a "can't deploy until after 8pm" limit this session) — not a bug, just the plan's constraint

## One-Time Migration Bootstrap

Before CI's `migrate-db` job can just apply deltas, the initial migration has to be applied manually once:

```bash
pnpm --filter @vc/db migrate:deploy
```

Prisma auto-loads `DATABASE_URL` from `packages/db/.env` (pointed at the real Supabase connection string) when the command runs with that package as cwd — no need to pass it inline once `.env` is set.

## Environment Files

All real `.env` files are gitignored (bare `.env` pattern in `.gitignore` matches at any depth).

| File                    | Holds                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/web/.env`         | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `API_INTERNAL_URL`, `TRUSTED_BFF_SECRET` |
| `apps/api/.env`         | `PORT`, `DATABASE_URL`, `SUPABASE_SECRET_KEY`, `TRUSTED_BFF_SECRET`                                          |
| `packages/db/.env`      | `DATABASE_URL` (used by Prisma CLI directly)                                                                 |
| `.env` (repo root, new) | `DEPLOY_WEB_URL`, `DEPLOY_API_URL` — used only by `scripts/verify-deploy.mjs`. Copy from `.env.example`.     |

`TRUSTED_BFF_SECRET` is set in both `apps/web/.env` and `apps/api/.env` (same value) for the BFF trusted-header pattern — see `CROSSCONTEXT_TODOS.md` for the still-unbuilt forwarding code that will actually use it.

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

## Known Open Items (as of 2026-07-08)

- Railway: not yet successfully deployed — blocked by the free-tier deploy timing restriction noted above.
- Supabase: hit a transient `PGRST002` ("could not query the database for the schema cache") 503 at one point. If this recurs, check the dashboard's project status (paused / restoring) before assuming a real bug — free-tier Supabase projects pause on inactivity same as Railway.
