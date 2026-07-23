import { getTeams } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { TeamsView } from "@/features/teams/teams-view"

export default async function TeamsPage() {
  const demo = await getDemoSession()
  if (!demo) return null

  const teams = await getTeams(demo.session)
  return <TeamsView session={demo.session} teams={teams} />
}
