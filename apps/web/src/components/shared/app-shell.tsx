import type { ReactNode } from "react"
import Link from "next/link"
import type { OrgRoleType } from "@vc/types"

export interface AppShellProps {
  orgRoles: OrgRoleType[]
  banner?: ReactNode
  children: ReactNode
}

// The nav/header shell for the whole app — not demo-specific. Route hrefs are
// hardcoded to /demo/* for now since that's the only reachable route tree;
// see __docs/plans for the follow-up once a real (non-demo) route tree exists.
export function AppShell({ orgRoles, banner, children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      {banner}
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 px-6 py-3">
          <span className="font-semibold">Volunteer Connect</span>
          <Link
            href="/demo/dashboard"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/demo/signups"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Signups
          </Link>
          <Link
            href="/demo/teams"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Teams
          </Link>
          {orgRoles.includes("admin") && (
            <Link
              href="/demo/signup-templates"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Templates
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
