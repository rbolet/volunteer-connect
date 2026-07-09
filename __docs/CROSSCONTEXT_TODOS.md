# Cross-Context TODOs

Items that span multiple features or layers and need to be implemented once at the right time, not scoped to any single feature task.

---

## Prisma Middleware — Audit Fields + Soft Deletes

**Why**: All non-pivot entities carry `created_by`, `updated_by`, and `deleted_at`. Prisma has no native support for these; they must be injected via a client extension/middleware.

**What to build** (`packages/db`):

- On `create`: set `created_by` and `updated_by` from context (user_id passed via `AsyncLocalStorage` or explicit context object).
- On `update`: set `updated_by` from context.
- On `delete`: intercept and convert to an `update` setting `deleted_at = now()` (soft delete).
- On `findMany` / `findFirst` / `findUnique`: inject `WHERE deleted_at IS NULL` automatically unless caller opts out.

**Excluded** from soft-delete and audit: join/pivot tables (`OrgRole`, `TeamMembership`, `SignupEligibleRole`) — rows are replaced, not soft-deleted, and don't need audit fields.

**Approach**: Prefer a Prisma Client Extension (`$extends`) over the deprecated `$use` middleware API (deprecated as of Prisma 4.16).

---

## Trusted BFF Header — Wire Up the Forwarding Code

**Why**: `TRUSTED_BFF_SECRET` is now set in both `apps/web/.env` and `apps/api/.env`, but the actual code that forwards the trusted header (Next.js API routes → Express, per the architecture's defense-in-depth pattern) doesn't exist yet. Spans both apps, not scoped to one feature.

**What to build**:

- BFF-side (`apps/web`): code that attaches `TRUSTED_BFF_SECRET` plus the validated `user_id`/`org_id` as an outgoing header on requests to Express.
- Express-side (`apps/api`): middleware that validates the header and rejects requests where it's missing or mismatched.
