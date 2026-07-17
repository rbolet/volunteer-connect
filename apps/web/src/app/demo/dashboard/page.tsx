import Link from "next/link"
import { getMyResponses, getSignups, getTeams } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/utils/format"
import { ResponseStatusBadge } from "../_components/status-badge"

export default async function DashboardPage() {
  const demo = await getDemoSession()
  if (!demo) return null // layout already renders the unseeded state

  const [signups, myResponses, teams] = await Promise.all([
    getSignups(demo.session),
    getMyResponses(demo.session),
    getTeams(demo.session),
  ])
  const openSignups = signups.filter((s) => s.status === "open")
  const topTeams = [...teams].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5)
  const myTeamIds = new Set(demo.session.team_roles.map((t) => t.team_id))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome back, {demo.user.name.split(" ")[0]}
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Open signups</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openSignups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing is open right now.</p>
            ) : (
              <ul className="space-y-3">
                {openSignups.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-4">
                    <Link
                      href={`/demo/signups/${s.id}`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {s.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {s.claimedSeats}/{s.totalSeats} seats
                      {s.closesAt ? ` · closes ${formatDate(s.closesAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>My claims</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myResponses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No claims yet — grab a slot from an open signup.
              </p>
            ) : (
              <ul className="space-y-3">
                {myResponses.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/demo/signups/${r.signupId}`}
                        className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {r.slotLabel}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.signupTitle} · {r.pointValue} pt{r.pointValue === 1 ? "" : "s"} →{" "}
                        {r.teamName}
                      </p>
                    </div>
                    <ResponseStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              <h2>Team points</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {topTeams.map((t) => (
                <li key={t.id} className="rounded-lg border p-3">
                  <p className="truncate text-sm font-medium">
                    {t.name}
                    {myTeamIds.has(t.id) && (
                      <span className="ml-1 text-xs text-muted-foreground">(my team)</span>
                    )}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">{t.totalPoints}</p>
                  <p className="text-xs text-muted-foreground">points</p>
                </li>
              ))}
            </ul>
            <Link
              href="/demo/teams"
              className="mt-4 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              All teams →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
