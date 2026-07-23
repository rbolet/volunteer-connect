import Link from "next/link"
import type { SignupTemplateListItem } from "@vc/types"
import { NewSignupForm } from "./components/new-signup-form"

export interface NewSignupViewProps {
  templates: SignupTemplateListItem[]
}

export function NewSignupView({ templates }: NewSignupViewProps) {
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
      <NewSignupForm templates={templates} />
    </div>
  )
}
