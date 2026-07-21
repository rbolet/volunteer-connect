"use client"

import { useState, useTransition } from "react"
import type { SignupTemplateListItem } from "@vc/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { deleteSignupTemplate } from "../../actions"

const ROLE_LABELS: Record<string, string> = {
  head_coach: "Head Coach",
  coach: "Coach",
  referee: "Referee",
  volunteer: "Volunteer",
}

function TemplateCard({ template }: { template: SignupTemplateListItem }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function remove() {
    setError(null)
    startTransition(async () => {
      const result = await deleteSignupTemplate(template.id)
      if (!result.ok) setError("Something went wrong — try again.")
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="leading-snug">{template.title}</CardTitle>
          <Button size="sm" variant="destructive" disabled={isPending} onClick={remove}>
            Delete
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {template.slots.length} slot{template.slots.length === 1 ? "" : "s"}
        </p>
        <div className="flex flex-wrap gap-2">
          {template.eligibleRoles.map((role) => (
            <Badge key={role} variant="outline">
              {ROLE_LABELS[role] ?? role}
            </Badge>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function TemplateList({ templates }: { templates: SignupTemplateListItem[] }) {
  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">No templates yet.</p>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  )
}
