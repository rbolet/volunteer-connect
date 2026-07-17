import Link from "next/link"
import { notFound } from "next/navigation"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { NewSignupForm } from "./_components/new-signup-form"

export default async function NewSignupPage() {
  const demo = await getDemoSession()
  if (!demo) return null
  // Non-admins have no business here (Express enforces this too).
  if (!demo.session.org_roles.includes("admin")) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/demo/signups"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← All signups
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New signup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Direct-claim: volunteers grab specific slots first-come, first-served.
        </p>
      </div>
      <NewSignupForm />
    </div>
  )
}
