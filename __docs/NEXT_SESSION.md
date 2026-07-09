# Next Session

Working notes for the next session to pick up. Not a durable reference doc — clear out/fold into `CROSSCONTEXT_TODOS.md` or a feature task once acted on.

## 1. Verify cross-service connectivity, not just each service's own health

`pnpm verify:deploy` currently checks Vercel, Railway, and Supabase independently (each service's own reachability/`/health`), but nothing yet exercises the actual paths between them:

- Vercel (Next.js BFF routes) → Railway (`apps/api`, internal network only, not publicly routable per `CLAUDE.md`)
- Railway (`apps/api`) → Supabase (Postgres via Prisma, plus Supabase Auth token validation)

Worth a script and/or a minimal integration test that actually drives one real request through the full chain (e.g. a BFF route that calls Express which queries Supabase) in both local dev and deployed environments — not just "is each endpoint up," but "can they actually reach and authenticate to each other." Note this depends on the trusted-BFF-header forwarding code, which isn't built yet (`CROSSCONTEXT_TODOS.md`) — may need to land that first or scope this to whatever's currently wired.

## 2. Docker as local dev environment for `apps/api`

This session's Railway debugging surfaced multiple issues (missing `tsconfig.base.json` in build context, pnpm workspace `node_modules` layout, stale Railway start-command override) that were only caught by deploying to Railway or manually running `docker build`/`docker run` locally, not by any part of the normal dev loop. Worth investigating running `apps/api` in Docker locally as (or alongside) the normal dev workflow, so container-specific issues surface immediately instead of at deploy time. Rough shape:

- Could be a `docker compose` setup for local dev (api container + whatever else), or just a documented `pnpm docker:dev`-style script wrapping `docker build && docker run` against the real Dockerfile.
- Should stay fast enough not to replace `tsx watch` for everyday iteration — likely a periodic/pre-push check rather than the default dev loop, similar in spirit to the CI `api-image-smoke-test` job added this session but runnable locally too.
