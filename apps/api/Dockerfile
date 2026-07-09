# syntax=docker/dockerfile:1
# TODO: For production, use `turbo prune --scope=@vc/api` to generate a
# minimal monorepo subset before building. See: https://turbo.build/repo/docs/guides/tools/docker

FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS installer
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/zod/package.json ./packages/zod/
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm --filter=@vc/api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/api/node_modules ./apps/api/node_modules
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
