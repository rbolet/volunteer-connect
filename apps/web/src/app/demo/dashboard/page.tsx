import { getMyResponses, getSignups, getTeams } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { DashboardView } from "@/features/dashboard/dashboard-view"

export default async function DashboardPage() {
  const demo = await getDemoSession()
  if (!demo) return null // layout already renders the unseeded state

  const [signups, myResponses, teams] = await Promise.all([
    getSignups(demo.session),
    getMyResponses(demo.session),
    getTeams(demo.session),
  ])

  return (
    <DashboardView
      session={demo.session}
      userName={demo.user.name}
      signups={signups}
      myResponses={myResponses}
      teams={teams}
    />
  )
}
