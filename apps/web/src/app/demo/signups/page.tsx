import { getSignups } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { SignupsListView } from "@/features/signups/signups-list-view"

export default async function SignupsPage() {
  const demo = await getDemoSession()
  if (!demo) return null

  const signups = await getSignups(demo.session)
  return <SignupsListView signups={signups} isAdmin={demo.session.org_roles.includes("admin")} />
}
