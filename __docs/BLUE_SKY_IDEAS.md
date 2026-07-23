# Blue Sky / Future Ideas

Load on demand. Speculative, not scoped or scheduled — capture enough context here that a future session can evaluate/plan without re-deriving it from scratch. Not a todo list; promote an item to `TO_DO_NEXT.md` or a plan when it's actually being scoped.

## 1. Multi-client access (Electron, React Native, or other non-Next.js client)

**What**: Allow a client other than the current Next.js web app (e.g. an Electron desktop app, a React Native mobile app, or any other abstract client) to consume the API.

**Why this doesn't work today**: The architecture (`__docs/AUTH.md`, `__docs/API.md`) is built BFF-first and assumes a Next.js server-side runtime:

- Session resolution happens behind Next.js's `SessionResolver` interface (demo path implemented; real Supabase path still a stub).
- Next.js forwards the resolved session to Express via trusted internal headers (`x-bff-secret`, `x-session` — a JSON `ResolvedSession` validated against `resolvedSessionSchema`).
- Express (`apps/api`) is internal-only on Railway's private network — not publicly routable, and not reachable directly from any browser or external client.
- `apps/web/src/lib/api/client.ts` is explicitly server-only; there is no client-side path to Express at all today.

A non-Next.js client has no equivalent "server" to run a `SessionResolver` or hold the `x-bff-secret`, so it structurally cannot talk to Express as currently wired.

**How this would likely need to work**: Supabase Auth is already the identity provider, and Supabase issues portable JWTs designed for exactly this case (mobile/desktop clients holding a token directly, no server-side BFF required). Rough shape:

- Either (a) expose a public-facing entry point (Express made reachable, or a thin gateway in front of it) that accepts a Supabase JWT directly and validates it itself, replacing the trusted-header handoff for non-web clients, or (b) keep Express internal-only and have each new client type get its own thin BFF (mirrors current Next.js role) — more consistent with current defense-in-depth model but more infra per client.
- Session validation logic would need to branch: trusted-header path (existing Next.js BFF) vs. bearer-JWT path (other clients), or unify on JWT validation everywhere and drop the header-trust model.
- `requireBffSecret`/`requireSession` middleware (`apps/api/src/app.ts`) would need a second auth strategy, not a replacement — the demo/admin web flow shouldn't regress.
- Out of scope for MVP pilot (~100 users, single web client) per `CLAUDE.md` — worth revisiting only if/when a second client type is actually committed to.

## 2. OpenAPI JSON spec for API documentation

**What**: Generate a machine-readable OpenAPI (Swagger) spec for the Express API, for documentation and potential client-generation purposes.

**Context**: `__docs/API.md` currently hand-maintains a markdown table of routes, kept in sync manually. Every route already has Zod request/response schemas in `packages/zod` (`*Input` write schemas + response/view-model schemas) — that's the reusable asset, not something to duplicate.

**How**:

- Use `@asteasolutions/zod-to-openapi` to derive the spec from the existing `packages/zod` schemas (add `.openapi()` metadata, register each route's path/method/body/response/error codes against an OpenAPI registry) rather than hand-writing a spec.
- New dependencies required: `@asteasolutions/zod-to-openapi`, and if a live UI is wanted, `swagger-ui-express` — new tooling, needs an explicit ask/approval per this project's "don't add dependencies beyond stated scope" convention.
- Auth representation doesn't map cleanly: the `x-bff-secret` + `x-session` two-header trust model isn't a standard OpenAPI bearer/apiKey scheme. Would need custom `apiKey`-in-header security scheme definitions — useful for documentation, but Swagger UI's "try it out" won't actually work against a Railway-internal-only service.
- Serving decision needed before implementation: Express is not publicly routable, so either (a) gate a Swagger UI route behind dev-only/internal auth, or (b) skip live UI and just emit a static spec file (JSON/YAML) as a documentation/codegen artifact.
- Potential win: spec generation could replace (or auto-generate) the manually-maintained table in `API.md`, and could run in CI to catch route/schema drift automatically instead of relying on someone remembering to update the doc.
- Ties into idea #1 above: if a second client type is ever added, a generated OpenAPI spec becomes considerably more valuable (client SDK generation, cross-team contract clarity) rather than purely a nice-to-have.

---

_First captured: 2026-07-23, from a conversation exploring Swagger/OpenAPI options._
