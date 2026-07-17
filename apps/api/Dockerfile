# syntax=docker/dockerfile:1
# TODO: For production, use `turbo prune --scope=@vc/api` to generate a
# minimal monorepo subset before building. See: https://turbo.build/repo/docs/guides/tools/docker

# The app runs from TypeScript source via tsx (no JS emit shipped): workspace
# packages (@vc/db, @vc/zod, …) export their src/*.ts directly, which plain
# `node dist/` cannot resolve at runtime. tsx gives every environment (dev,
# vitest, prod) one uniform resolution path; the startup transform cost is
# negligible for a long-running Express service.

FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS installer
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/logger/package.json ./packages/logger/
COPY packages/types/package.json ./packages/types/
COPY packages/zod/package.json ./packages/zod/
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY apps/api ./apps/api
COPY packages ./packages
# Prisma client generation is a runtime requirement (works without
# DATABASE_URL — see packages/db/prisma.config.ts); typecheck is the build
# gate now that no JS is emitted.
RUN pnpm --filter=@vc/db db:generate && pnpm --filter=@vc/api typecheck

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages ./packages
# node_modules comes from builder (not installer) so it includes the
# generated Prisma client.
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
CMD ["apps/api/node_modules/.bin/tsx", "apps/api/src/index.ts"]
