import Link from "next/link"
import type { SignupTemplateListItem } from "@vc/types"
import { Button } from "@/components/ui/button"
import { TemplateList } from "./components/template-list"

export interface TemplateListViewProps {
  templates: SignupTemplateListItem[]
}

export function TemplateListView({ templates }: TemplateListViewProps) {
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
