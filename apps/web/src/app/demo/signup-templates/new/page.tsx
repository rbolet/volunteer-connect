import Link from "next/link"
import { notFound } from "next/navigation"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { NewTemplateForm } from "./_components/new-template-form"

export default async function NewSignupTemplatePage() {
  const demo = await getDemoSession()
  if (!demo) return null
  // Non-admins have no business here (Express enforces this too).
  if (!demo.session.org_roles.includes("admin")) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/demo/signup-templates"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← All templates
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New template</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build a reusable blueprint to pre-fill future signups with.
        </p>
      </div>
      <NewTemplateForm />
    </div>
  )
}
