import Link from "next/link"
import { NewTemplateForm } from "./components/new-template-form"

export function NewTemplateView() {
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
