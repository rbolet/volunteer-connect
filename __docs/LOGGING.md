# Logging — Implementation Plan

Engineering reference for `packages/logger`. Safe to load into the Claude Code session alongside DATA_MODEL.md / TESTING.md.

## Scope

Add structured logging shared across `apps/api` (Railway) and any server-side code in `apps/web` (Vercel). No external log storage in this phase — rely on each platform's built-in log capture (Vercel Runtime Logs, Railway log viewer). Zero cost, zero third-party data processor.

**v1 (current):** `packages/logger` ships as a plain `console.log`/`console.warn`/`console.error` wrapper — no `pino` dependency yet. It implements the same public surface described below (`logger.debug/info/warn/error`, `createChildLogger`, `LOG_LEVEL` filtering) so call sites written against v1 do not need to change when the internals are swapped for real `pino`. **Redaction is not implemented in v1** — it was deliberately deferred because a hand-rolled scrubber would not carry over unchanged to `pino`'s own `redact` config, and pulling in `pino`'s underlying `fast-redact` dependency directly for v1 was judged out of scope for a stopgap. Until the `pino` migration lands, callers must not pass sensitive fields (email, phone, password, tokens, address) into log metadata.

## Package

New workspace package: `packages/logger`.

- Language: TypeScript, matches repo convention.
- Single default export: a configured `pino` instance plus a `createChildLogger(bindings)` helper for per-request/per-module context (e.g. `{ requestId, userId, route }`).
- Consumed by `apps/api` and `apps/web` as an internal workspace dependency: `@vc/logger` (matches the `@vc/*` scope used by every other package in this repo — `@ayso/logger` in an earlier draft of this doc was a naming slip).

## Dependencies

- `pino` — core logger. Fast, JSON by default, negligible overhead, works in both long-running (Railway/Express) and serverless (Vercel functions) contexts.
- `pino-pretty` — **devDependency only**, used for local dev formatting. Must not ship to production.

Do not add a pino _transport_ (worker-thread based) in the Vercel serverless build — the function can be frozen/killed before the worker flushes, silently dropping logs. Production logger writes synchronously to stdout as plain JSON in both environments. Pretty-printing is a local-dev-only code path, gated by `NODE_ENV`.

## Design

### Core logger

```ts
// packages/logger/src/index.ts
import pino from "pino"

const isDev = process.env.NODE_ENV !== "production"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  transport: isDev ? { target: "pino-pretty", options: { colorize: true } } : undefined, // plain JSON to stdout in prod — no worker transport
})

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings)
}
```

### Redaction (non-negotiable, per project privacy policy)

Users are largely parents; treat all personal data as sensitive by default. Define `REDACT_PATHS` covering, at minimum, any field likely to appear in request bodies or error objects:

- `email`, `*.email`
- `phone`, `*.phone`
- `password`, `*.password`, `*.token`, `*.accessToken`
- `address`, `*.address`
- child/participant name fields if any signup payload includes them

Redaction happens inside the logger, not at call sites — callers should not have to remember to scrub data before logging.

### Environment behavior

| Context                              | Output                    | Notes                                                                                   |
| ------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------- |
| Local dev                            | Pretty-printed, colorized | `pino-pretty`, devDependency only                                                       |
| Railway (`apps/api`)                 | JSON to stdout            | Captured natively, 30-day retention on Hobby plan                                       |
| Vercel (`apps/web` server functions) | JSON to stdout            | Captured natively via Runtime Logs, short retention on Hobby plan — expected, not a bug |

## Integration points

- `apps/api`: request logging middleware (method, path, status, duration, requestId) using `createChildLogger`. Replace any existing `console.log`/`console.error` calls in route handlers and services with the shared logger.
- `apps/web`: any server-side API routes or edge functions that currently use `console.*` should switch to the shared logger.
- Do not add client-side/browser logging in this phase — no analytics/tracking by default per project instructions.

## Environment variables

- `LOG_LEVEL` — `debug` | `info` | `warn` | `error`, default `info`. Set per-environment in Railway/Vercel dashboards.

## Testing

Per project convention (unit tests required for business logic), cover:

- Redaction actually strips configured fields from log output (test against a captured stream, not visual inspection).
- Log level filtering works as expected.
- `createChildLogger` correctly merges bindings.

## Non-goals for this phase

- No log aggregation/shipping to a third-party service.
- No log-based alerting.
- No client-side logging.

## Future option (not in scope now)

If cross-service search or longer retention becomes necessary post-validation, ship logs directly to a free-tier aggregator (e.g. Axiom, 500GB/month free) via an `axiom-js`/pino transport added to this same package — bypasses Vercel's paid native Log Drains entirely and requires no changes at call sites. Revisit privacy implications (third-party data processor) before enabling.

## Acceptance criteria

- [ ] `packages/logger` builds and is importable from both `apps/api` and `apps/web`.
- [ ] No `console.*` calls remain in `apps/api` route handlers/services.
- [ ] Redaction test suite passes.
- [ ] Local dev shows pretty output; production build emits plain JSON with no transport/worker warnings on Vercel.
