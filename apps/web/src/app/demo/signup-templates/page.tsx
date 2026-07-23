import { notFound } from "next/navigation"
import { getSignupTemplates } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { TemplateListView } from "@/features/signup-templates/template-list-view"

// Admin-only authoring surface — mirrors the /demo/signups list page's gate.
export default async function SignupTemplatesPage() {
  const demo = await getDemoSession()
  if (!demo) return null
  if (!demo.session.org_roles.includes("admin")) notFound()

  const templates = await getSignupTemplates(demo.session)
  return <TemplateListView templates={templates} />
}
