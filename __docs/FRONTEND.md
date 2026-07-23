# Frontend — Components & Styling

Load on demand. Referenced from CLAUDE.md. Not always-on.

## UI Library

shadcn/ui, built on **Radix primitives** (`shadcn init -b radix`, not Base UI). Icon library: `lucide-react`.

Vendored so far (2026-07-15): `button`, `card`, `badge`, `table`, `separator`, `input`, `label`, `checkbox`, `textarea`. Add more via `shadcn add <component>`; keep the set minimal — only what's actually used.

**Gotcha — `CardTitle` renders a `div`, not a heading.** For real heading semantics (and honest `getByRole("heading")` tests), nest an `<h2>` inside it (see `features/dashboard/dashboard-view.tsx`).

## Directory Structure

**Route glue vs. feature code.** `app/demo/**/page.tsx` files are intentionally thin: resolve the session (`getDemoSession()`), fetch data via `lib/api/queries.ts`, and render a `*-view.tsx` component from `features/`. Only things that are genuinely demo-only — the banner, the "view as" switcher, the unseeded-org fallback — live under `app/demo/`. Everything else (the dashboard, signups, teams, signup-templates UI and their server actions) lives in `features/`, so it isn't tied to the `/demo` URL prefix by folder name, only by which route currently imports it. This split matters because `/demo/*` is the only reachable route tree today (`resolverFor()` dispatches everything else to a stubbed, always-`null` `supabaseSessionResolver` — see AUTH.md); once real auth lands, a second route tree will import these same `features/` modules rather than duplicating them (see `__docs/plans/REAL_AUTH_ROUTE_TREE.md` for that follow-up — routing/dispatch changes only, no further file moves needed here).

```
apps/web/src/
  middleware.ts     # /demo/* only: route dispatch + signed demo cookie (Edge; see AUTH.md)
  components/
    ui/            # shadcn-generated primitives — CLI-owned/vendored, don't hand-edit,
                    # update via `shadcn add --overwrite`
    shared/         # hand-built reusable compositions across features, built from ui/ primitives
                    # (app-shell.tsx = nav/header; status-badge.tsx = signup/response badges)
  features/
    dashboard/      # dashboard-view.tsx
    teams/          # teams-view.tsx
    signups/        # actions.ts, signups-list-view.tsx, signup-detail-view.tsx,
                    # new-signup-view.tsx, components/ (admin-status-controls, claim-cell,
                    # slot-editor, new-signup-form, save-as-template-button) + components/__tests__/
    signup-templates/  # actions.ts, template-list-view.tsx, new-template-view.tsx,
                    # components/ (template-list, new-template-form)
  app/
    page.tsx        # landing → links to /demo (the old /health redirect is gone; /health still exists)
    demo/           # thin route entries only: layout.tsx (banner + AppShell), actions.ts
                    # (switchIdentity only), _components/demo-banner.tsx, dashboard/page.tsx,
                    # signups/ (+ new/, [id]/), signup-templates/ (+ new/), teams/page.tsx
    <route>/
      _components/  # route/feature-scoped components, not reused elsewhere
                    # (leading underscore = excluded from Next.js routing)
  hooks/            # shared hooks
  lib/
    api/            # client.ts (server-only BFF→Express fetch, attaches trusted headers),
                    # queries.ts (read queries, re-validated against @vc/zod response schemas),
                    # mutations.ts (adminMutation() — shared write-side helper used by
                    # features/*/actions.ts)
    auth/           # demo-cookie.ts (Web Crypto HMAC, Edge+Node), session-resolver.ts
    utils/          # cn() helper etc.; format.ts (date display)
```

No `packages/ui` workspace package — `apps/web` is the only UI consumer (`apps/api` is headless Express). Reconsider only if a second frontend app appears.

## Tailwind v4

Upgraded from v3 this session. Browser floor: Safari 16.4+ / Chrome 111+ / Firefox 128+ — accepted as a reasonable baseline for a 2026 pilot audience.

- CSS-first config. No `tailwind.config.ts`.
- `globals.css` must import Tailwind **directly**:

  ```css
  @import "tailwindcss";
  @import "tw-animate-css";

  @source "../";

  @custom-variant dark (&:is(.dark *));
  ```

- **Critical gotcha — do not use `@import "shadcn/tailwind.css";`.** That's the shadcn CLI's default generated output (`shadcn init` with recent CLI versions writes this), but it silently breaks Tailwind v4's automatic content detection in this monorepo: the CSS builds with zero errors but **zero utility classes get generated anywhere in the app** (only literal CSS written directly in `globals.css` survives). This is exactly what broke the `/health` page's styling on the first shadcn install — `bg-black`, `text-amber-400`, `text-8xl`, etc. were silently absent from the compiled CSS. Root cause: v4's auto-detection anchors to wherever the actual `@import "tailwindcss"` statement lives, and `shadcn/tailwind.css` buries it inside `node_modules`. Always import `tailwindcss` directly in `globals.css` and keep the explicit `@source "../";` directive pointing at `apps/web/src`.
- `@theme inline { --color-*: var(--*); --radius-*: ...; }` block is required and manually maintained in `globals.css` — it maps the CSS custom properties (`--background`, `--border`, etc.) to Tailwind theme tokens. Without it, utilities like `border-border`/`bg-background` fail as "unknown utility class."
- `layout.tsx` wires in the Geist font (`next/font/google`) via a `font-sans` CSS variable, applied on `<html>` with the `cn()` helper.

## Client state vs. the demo identity switcher

The "view as" switcher swaps the session **without remounting client components** (server action re-issues the cookie, RSC re-renders in place). Any client component that captures session-derived props in `useState` at mount (e.g. "which team to credit") will hold stale values across a switch. Rules:

- Derive session-dependent values from **current props** at render time, not mount-time state (see `claim-cell.tsx`'s `effectiveTeamId`).
- Key such components by `session.user_id` so an identity switch remounts them and clears transient state (errors, selections).

This caused a real bug (claim posted an empty team after Admin→Volunteer switch); regression test in `claim-cell.test.tsx`.

## Testing

`vitest-axe` added for automated accessibility assertions (`expect(container).toHaveNoViolations()`), wired into `apps/web/src/test/setup.ts`:

```ts
import * as axeMatchers from "vitest-axe/matchers"
expect.extend(axeMatchers)
```

vitest 3 needs the module augmentation in `src/test/vitest-axe.d.ts` for the matcher types (the package only ships legacy `Vi`-namespace types). `vitest.config.ts` mirrors the `@/*` tsconfig alias and excludes `e2e/**` (Playwright's, not vitest's).

Otherwise unchanged from `TESTING.md` — RTL + `user-event` remain the primary component-testing tools.
