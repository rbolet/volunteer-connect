import Link from "next/link"
import { notFound } from "next/navigation"
import { getSignupTemplates } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { Button } from "@/components/ui/button"
import { TemplateList } from "./_components/template-list"

// Admin-only authoring surface — mirrors the /demo/signups list page's gate.
export default async function SignupTemplatesPage() {
  const demo = await getDemoSession()
  if (!demo) return null
  if (!demo.session.org_roles.includes("admin")) notFound()

  const templates = await getSignupTemplates(demo.session)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Signup templates</h1>
        <Button asChild size="sm">
          <Link href="/demo/signup-templates/new">New template</Link>
        </Button>
      </div>
      <TemplateList templates={templates} />
    </div>
  )
}
