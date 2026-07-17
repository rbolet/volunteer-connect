import type { DemoIdentity, DemoSessionResponse } from "@vc/types"
import { Button } from "@/components/ui/button"
import { switchIdentity } from "../actions"

export const IDENTITY_LABELS: Record<DemoIdentity, string> = {
  admin: "Admin",
  head_coach: "Head Coach",
  coach: "Coach",
  referee: "Referee",
  volunteer: "Volunteer",
}

// The "view as" switcher posts to a server action that re-issues the signed
// demo cookie for another fixed identity (DEMO_MODE.md) — plain form submits,
// no client JS needed.
export function DemoBanner({ demo }: { demo: DemoSessionResponse }) {
  return (
    <div className="border-b border-amber-300/60 bg-amber-100 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950 dark:text-amber-100">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-2">
        <p className="text-sm">
          <span className="font-semibold">Demo mode</span> — viewing as {demo.user.name} (
          {IDENTITY_LABELS[demo.identity]})
        </p>
        <form action={switchIdentity} className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide opacity-70">
            View as
          </span>
          {(Object.keys(IDENTITY_LABELS) as DemoIdentity[]).map((identity) => (
            <Button
              key={identity}
              type="submit"
              name="identity"
              value={identity}
              size="xs"
              variant={identity === demo.identity ? "default" : "outline"}
              disabled={identity === demo.identity}
            >
              {IDENTITY_LABELS[identity]}
            </Button>
          ))}
        </form>
      </div>
    </div>
  )
}
