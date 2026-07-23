import type { ReactNode } from "react"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { AppShell } from "@/components/shared/app-shell"
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
    <AppShell
      orgRoles={demo.session.org_roles}
      banner={demo.session.source === "demo" ? <DemoBanner demo={demo} /> : undefined}
    >
      {children}
    </AppShell>
  )
}
