import type { ReactNode } from "react"
import Link from "next/link"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { DemoBanner } from "./_components/demo-banner"

// The demo banner + switcher are driven by session.source here, in one place
// (DEMO_MODE.md): nothing below this layout branches on demo-ness — pages and
// components only ever see org/roles, exactly as they would for a real org.
export default async function DemoLayout({ children }: { children: ReactNode }) {
  const demo = await getDemoSession()
  if (!demo) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">Demo unavailable</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            The demo organization hasn&apos;t been seeded yet. Run{" "}
            <code className="rounded bg-muted px-1 py-0.5">pnpm --filter @vc/db db:seed</code> and
            reload.
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen">
      {demo.session.source === "demo" && <DemoBanner demo={demo} />}
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
          {demo.session.org_roles.includes("admin") && (
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
