import { notFound } from "next/navigation"
import { getSignupDetail, getTeams } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { SignupDetailView } from "@/features/signups/signup-detail-view"

export default async function SignupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const demo = await getDemoSession()
  if (!demo) return null

  const [signup, teams] = await Promise.all([
    getSignupDetail(demo.session, id),
    getTeams(demo.session),
  ])
  if (!signup) notFound()

  return <SignupDetailView session={demo.session} signup={signup} teams={teams} />
}
