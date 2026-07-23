import { notFound } from "next/navigation"
import { getSignupTemplates } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { NewSignupView } from "@/features/signups/new-signup-view"

export default async function NewSignupPage() {
  const demo = await getDemoSession()
  if (!demo) return null
  // Non-admins have no business here (Express enforces this too).
  if (!demo.session.org_roles.includes("admin")) notFound()

  const templates = await getSignupTemplates(demo.session)
  return <NewSignupView templates={templates} />
}
