# API — Express Endpoint Surface & Conventions

Load on demand. As-built reference for `apps/api` (2026-07-15). Update this when routes change.

## Auth layers (in order, `apps/api/src/app.ts`)

1. `GET /health` — unauthenticated (platform health checks).
2. `requireBffSecret` — everything else needs `x-bff-secret` (timing-safe compare vs `TRUSTED_BFF_SECRET`; fails closed 500 if unconfigured).
3. `/internal/*` — secret only, **pre-session** (this is where sessions come from).
4. `requireSession` — all business routes additionally need `x-session`: a JSON `ResolvedSession` validated against `resolvedSessionSchema` (`@vc/zod`), attached as `req.session`.
5. `requireAdmin` — per-route on admin mutations: 403 `admin_only` unless `org_roles` includes `admin`.

Errors are always `{ error: "<snake_case_code>" }`. 400 invalid body, 401 auth, 403 role, 404 not found (including "exists but not yours" — deliberately not 403), 409 business-rule rejection, 500 `internal_error`.

## Endpoints

| Method/Path                                                        | Who     | Purpose / notes                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /internal/demo-session?identity=`                             | BFF     | Fixed demo identity (enum) → `DemoSessionResponse`. 503 `demo_not_seeded` if the demo org/users are missing.                                                                                                                                                |
| `GET /internal/user-session?auth_id=`                              | BFF     | Supabase `auth_id` → `AppSessionResponse`. 404 `user_not_found` if no `User` row exists yet — the "needs org" signal (not an error), see `AUTH.md`.                                                                                                         |
| `GET /internal/invites/:token/validate`                            | BFF     | `OrgInvite` lookup, no mutation. 404 `not_found`, 410 `expired`, 409 `redeemed`, else 200 `{org_id, org_name}`.                                                                                                                                             |
| `POST /internal/invites/redeem`                                    | BFF     | Body `inviteRedeemInputSchema` (`{token, authId, email, name}`). Transactional: creates a plain `User` (no `OrgRole`/`TeamMembership`) + stamps the invite redeemed. Same status codes as validate, plus 400 `email_mismatch`/`invalid_input`.              |
| `GET /signups`                                                     | session | `SignupListItem[]`. Drafts hidden from non-admins.                                                                                                                                                                                                          |
| `GET /signups/:id`                                                 | session | `SignupDetail`. Drafts 404 for non-admins; while open/closed, responses redacted to own-only (per-slot `claimedCount` survives redaction). Full roster for admins or once finalized.                                                                        |
| `POST /slots/:slotId/responses`                                    | session | DIRECT_CLAIM claim, body `slotClaimSchema` (`{teamId}`). Serializable transaction + retry (race-safe capacity); 409 `already_claimed`/`slot_full`/`signup_not_open`/`wrong_mode`, 403 `not_eligible`/`not_your_team`.                                       |
| `DELETE /slot-responses/:id`                                       | session | Withdraw own `pending` response while open — hard delete (frees the `(user_id, slot_id)` unique for re-claim).                                                                                                                                              |
| `GET /teams`                                                       | session | `TeamWithPoints[]` — `totalPoints` computed from `points_ledger` (never stored).                                                                                                                                                                            |
| `GET /me/responses`                                                | session | `MyResponseView[]` for the session user (dashboard "my claims").                                                                                                                                                                                            |
| `POST /signups`                                                    | admin   | `createSignupSchema` → draft DIRECT_CLAIM signup on the **active season**, nested slots+eligibleRoles. 409 `no_active_season`. Creation is DIRECT_CLAIM-only until RANKED_CHOICE's volunteer flow exists.                                                   |
| `PATCH /signups/:id/status`                                        | admin   | `signupStatusChangeSchema`. Transitions: draft→open, open→closed, closed→open, closed→finalized (terminal). **Finalize** = bulk: all non-declined responses → `completed` + one ledger row each, one transaction, only on the transition (no double-award). |
| `POST /signups/:id/slots`, `PATCH /slots/:id`, `DELETE /slots/:id` | admin   | Slot editing while draft/open only; 409 `slot_has_claims` (delete) / `capacity_below_claims` (update). Deletes are hard (a deletable slot has no claims).                                                                                                   |

## Internal structure

- **Pure rules** (`src/lib/claim-rules.ts`, `src/lib/status-rules.ts`): all business verdicts (`evaluateClaim`, `evaluateWithdraw`, `evaluateStatusChange`, `evaluateSlotEdit`) are Prisma-free and exhaustively unit-tested; repositories evaluate them inside transactions on freshly read state.
- **Repository layer** (`src/repositories/`): all Prisma access, org-scoped on every query, explicit `deleted_at: null` filters (the soft-delete client extension is still deferred). `createRepos(prisma)` is injected into `createApp(repos)` — route tests substitute in-memory fakes (`src/__tests__/helpers.ts`).
- **Async routes** are wrapped with `asyncHandler` (Express 4 doesn't forward promise rejections); the terminal error middleware logs via `@vc/logger` and returns 500.

## Consuming from the web app

`apps/web/src/lib/api/client.ts` (server-only — attaches both headers) + `queries.ts` (re-validates every response against the shared Zod response schemas). Never call Express from client components; mutations go through server actions in `apps/web/src/app/demo/actions.ts`.
