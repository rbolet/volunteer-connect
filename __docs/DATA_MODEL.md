# Volunteer Connect — Data Model Reference

Upload to Project Knowledge. Reference from task-specific chats; not part of always-on instructions.

## Assumptions

- `Organization` entity included now even though MVP targets one org — avoids a costly migration if expanded to multiple AYSO regions later. MVP UI can hardcode a single org context.
- Two signup modes exist and must be modeled distinctly:
  - `RANKED_CHOICE` — volunteer submits ranked preferences across slots (field/timeslot example); admin manually resolves conflicts after close.
  - `DIRECT_CLAIM` — volunteer claims one specific slot outright, first-come (tent example).
- Point awarding is a distinct admin action ("confirm completion"), separate from slot claiming — points aren't awarded just for signing up.
- `Season` is a first-class org-scoped entity. Teams and Signups reference a `season_id`. The active season drives default views.
- Team self-join defaults to `volunteer` role. Configurable role assignment rules are deferred post-MVP.
- `eligible_roles` on Signup is stored as a separate `SignupEligibleRole` join table, not an array/JSON column.
- All entities carry standard audit/soft-delete fields: `created_at`, `updated_at` (auto-managed by Prisma), `created_by` (user_id FK), `updated_by` (user_id FK), and `deleted_at` (nullable DateTime — soft delete). These are injected via Prisma middleware; queries must filter `deleted_at IS NULL` by default. Join/pivot tables (OrgRole, TeamMembership, SignupEligibleRole) are excluded — they are replaced, not soft-deleted.

## Entities

**Organization**

- id, name, is_demo (bool, default false — marks the single seeded demo org; see `DEMO_MODE.md`)

**User**

- id, org_id, auth_id (Supabase), email, name, created_at

**OrgRole**

- user_id, org_id, role (`admin`)
- Org-scoped admin/coordinator permission, separate from team-level roles.

**Season**

- id, org_id, name (string, e.g. "Fall 2025"), is_active (bool)

**Team**

- id, org_id, season_id (FK → Season), name, team_number (nullable int), color (nullable string)
- `team_number` and `name` are display/reference labels, not identifiers — neither is DB-unique. AYSO team numbers are typically assigned per division/age-group, so two teams can plausibly share the same number (or name) within one org/season. Always use `id` for lookups; never assume `team_number` or `name` uniqueness in application code or seed/fixture data.

**TeamMembership**

- user_id, team_id, role (`head_coach` | `coach` | `referee` | `volunteer`)
- Composite key (user_id, team_id, role) — a user can hold multiple roles on the same team, and belong to multiple teams.

**Event**

- id, org_id, season_id (FK → Season), name, event_date
- Groups the set of Signups tied to one real-world occasion (e.g. Friday field prep + Saturday tent duty for the same game weekend, a tournament, a registration day) so they can be managed/queried/cloned as a unit instead of admins recreating unrelated Signups every week by hand.
- Optional — a Signup doesn't have to belong to one (e.g. a standalone registration-day signup with no companion signups).

**Signup**

- id, org_id, season_id (FK → Season), event_id (nullable FK → Event), title, description, mode (`RANKED_CHOICE` | `DIRECT_CLAIM`)
- opens_at, closes_at, status (`draft` | `open` | `closed` | `finalized`)

**SignupEligibleRole**

- signup_id, role (`head_coach` | `coach` | `referee` | `volunteer`)
- Replaces the former `eligible_roles` field on Signup. Defines which TeamMembership roles may respond.

**SignupSlot**

- id, signup_id, label, point_value, capacity (default 1)

**SlotResponse**

- id, slot_id, user_id, team_id (which team gets the points)
- rank (nullable — used only in RANKED_CHOICE mode)
- status (`pending` | `assigned` | `declined` | `completed`)
- Unique constraint: (user_id, slot_id) — prevents duplicate responses per slot.
- DIRECT_CLAIM: a user may claim multiple slots within the same signup (no signup-level cap).
- RANKED_CHOICE: one rank entry per slot per user.
- `declined` is set by admins only (RANKED_CHOICE rejection/reassignment). Volunteers withdraw by deleting their response while the signup is `open`.
- Editable by the submitting user only while signup.status = `open`.

**PointsLedger**

- id, team_id, slot_response_id, points, awarded_by (user_id), awarded_at
- Written only when admin confirms completion. Team point totals = SUM(points) grouped by team_id — compute via query/view, don't store a running total (avoids drift).

## Signup Lifecycle

```
draft → open → closed → [RANKED_CHOICE: admin finalizes assignments] → finalized
                       → [DIRECT_CLAIM: admin confirms completions]   → finalized
```

- `draft`: admin builds slots, not visible to volunteers.
- `open`: eligible volunteers submit/edit responses (ranked choices or direct claims) until `closes_at`.
- `closed`: volunteer edits locked. RANKED_CHOICE → admin manually assigns, resolving conflicts. DIRECT_CLAIM → claims stand as-is; admin confirms completion post-event (may happen after the event date, not necessarily immediately at close).
- `finalized`: assignments locked, points awarded to PointsLedger on completion confirmation. Volunteers: view-only. Admins: retain edit rights.
- **Current implementation (2026-07-15)** confirms completions in bulk at the moment of finalizing: every non-declined response is marked `completed` and awarded its slot's points in one transaction. Per-response confirmation (the model described above) is a future refinement. Transitions implemented: draft→open, open→closed, closed→open (reopen), closed→finalized; finalized is terminal (no un-finalize/point clawback).

## Permission Matrix

| Action                                | Admin                   | Volunteer (any role)         |
| ------------------------------------- | ----------------------- | ---------------------------- |
| Create/edit signup (draft)            | ✓                       | —                            |
| View open signup                      | ✓                       | ✓ (if eligible_role matches) |
| Submit/edit response during `open`    | ✓ (on behalf of anyone) | ✓ (own responses only)       |
| View responses during `open`/`closed` | ✓                       | own only                     |
| Finalize assignments (RANKED_CHOICE)  | ✓                       | —                            |
| Confirm completion → award points     | ✓                       | —                            |
| Edit after `finalized`                | ✓                       | —                            |
| View team point totals                | ✓ (all teams)           | ✓ (own teams)                |
| Create/manage teams                   | ✓                       | —                            |
| Join/leave a team                     | —                       | ✓ (self-service)             |

## Demo Mode

A permanent public demo is planned as a second `Organization` row (`is_demo = true`), isolated by the same org-scoping/RLS as any real org — not a separate system. See `DEMO_MODE.md` for the full design (auth adapter, seed script, reset job, frontend entry point); not restated here.

## Deferred (not MVP)

- Automated email/reminder system (signup open/close notices, point-deficit warnings).
- Billing/Stripe, multi-tenant org management.
