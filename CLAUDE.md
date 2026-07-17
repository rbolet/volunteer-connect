# Volunteer Connect — Project Instructions

## Purpose

Portfolio SaaS MVP: AYSO local orgs manage volunteer/coach/referee signups, track team points. Free pilot ~100 users; built to scale post-validation.

## On-demand Context

- Individual context markdown files can be found in `__docs/`
- Use these files to minimize token useage by breaking down contexts and tasks
- Propose updates to these context references as appropriate

## Stack (fixed)

- Monorepo: Turborepo (`apps/web`, `apps/api`, `packages/db`, `packages/types`, `packages/zod`)
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Radix) → Vercel
- Backend: Node/Express API, TypeScript, Prisma ORM, Docker → Railway (internal network only, not publicly routable)
- Data/Auth/Storage: Supabase (Postgres, Supabase Auth via `@supabase/ssr`, Storage)
- Validation: Zod — shared schemas in `packages/zod`, consumed by both apps
- CI/CD: GitHub Actions (lint → test → deploy)
- Testing: Vitest + RTL + MSW (unit/integration), Playwright (E2E) — see `__docs/TESTING.md`

## Architecture

- **BFF pattern**: Next.js resolves the session behind a `SessionResolver` interface (see `__docs/AUTH.md` — demo path implemented 2026-07-15; Supabase path still a stub) — real sessions via `@supabase/ssr` (future), demo sessions via a password-less resolver scoped to a fixed demo org — and forwards the full `ResolvedSession` to Express via trusted internal headers. Express never handles raw Supabase tokens, and is agnostic to which resolver ran.
- Express is internal-only (Railway private network) — not directly reachable from the browser. Endpoint surface + conventions: `__docs/API.md`.
- Shared types in `packages/types`; Prisma client + schema in `packages/db` (runtime access only via `createPrismaClient()` — Prisma 7 requires the pg driver adapter); Zod schemas in `packages/zod` (`*Input` write schemas + response/view-model schemas).
- Defense in depth: RLS at DB layer (deferred for pilot — see `CROSSCONTEXT_TODOS.md`), Next.js middleware at route layer, Express trusts BFF-validated user context.

## Domain glossary (full schema in DATA_MODEL.md — don't restate it, reference it)

- Users hold ≥1 role: admin/coordinator, coach, referee, volunteer. Two functional groups: Admins (create/manage) vs Volunteers (participate) — one user can be both.
- Users ↔ Teams: many-to-many.
- Signups: admin-defined, contain slots (job × timeslot), have an open/close window, optional points per slot. Volunteers claim slots and pick which of their teams gets the points.
- Points accrue to Teams, not individuals.

## Conventions

- Enforce role/team access via Supabase RLS, not frontend checks alone.
- Defense in depth: RLS at DB layer, Next.js middleware at route layer, Express trusts pre-validated user context — never rely on a single enforcement point.
- TDD preferred: write failing test first, implement, refactor. See `__docs/TESTING.md` for stack + patterns.
- Prefer enterprise patterns (repository layer, clear separation of concerns) except where complexity burden clearly exceeds benefit for a single developer.
- MVP scope: solo accounts, no billing. Don't build org billing/multi-tenancy.
- Any future notification feature: draft message content via Anthropic API (LLM-assisted), admin reviews/sends — don't auto-send.

## Privacy (non-negotiable)

- Collect only fields required for auth + coordination. No analytics/tracking by default.
- Users are largely parents — treat all data as sensitive by default. Minimize retention, no third-party sharing.
- Any email/notification feature requires explicit opt-in.

## Working style

- No filler, no unsolicited praise/hedging.
- CLI commands: one-line purpose stated before each command.
- Implement only what is explicitly scoped in the current task. Do not add files, dependencies, or configuration beyond the stated scope — ask first.
- Before designing schema/API/UI for a new feature, check DATA_MODEL.md is current; propose updates to it rather than embedding schema details in chat.
- **Session log** ("make today's session entry"): append to `__docs/sessions/YYYY-MM-DD.md` — one file per calendar date; add new `##` sections to today's file if it already exists rather than creating a second file. Record critical decisions, where things landed, and the actual actions/files changed — not the reasoning or back-and-forth that led there. A one-line "why" is fine for a non-obvious call (e.g. "deferred RLS — pilot speed over defense-in-depth while only one org exists"); skip blow-by-blow deliberation.
