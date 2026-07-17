import Link from "next/link"
import { getSignups } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/utils/format"
import { SignupStatusBadge } from "../_components/status-badge"

export default async function SignupsPage() {
  const demo = await getDemoSession()
  if (!demo) return null

  const signups = await getSignups(demo.session)
  const isAdmin = demo.session.org_roles.includes("admin")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Signups</h1>
        {isAdmin && (
          <Button asChild size="sm">
            <Link href="/demo/signups/new">New signup</Link>
          </Button>
        )}
      </div>
      {signups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No signups yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {signups.map((s) => (
            <Link key={s.id} href={`/demo/signups/${s.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/25">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="leading-snug">{s.title}</CardTitle>
                    <SignupStatusBadge status={s.status} />
                  </div>
                  {s.eventName && <CardDescription>{s.eventName}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {s.claimedSeats}/{s.totalSeats} seats claimed
                    {s.status === "open" && s.closesAt ? ` · closes ${formatDate(s.closesAt)}` : ""}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
