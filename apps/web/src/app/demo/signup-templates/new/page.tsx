import { notFound } from "next/navigation"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { NewTemplateView } from "@/features/signup-templates/new-template-view"

export default async function NewSignupTemplatePage() {
  const demo = await getDemoSession()
  if (!demo) return null
  // Non-admins have no business here (Express enforces this too).
  if (!demo.session.org_roles.includes("admin")) notFound()

  return <NewTemplateView />
}
