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
