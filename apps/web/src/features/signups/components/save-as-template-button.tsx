"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveSignupAsTemplate } from "@/features/signup-templates/actions"

export interface SaveAsTemplateButtonProps {
  signupId: string
  signupTitle: string
}

export function SaveAsTemplateButton({ signupId, signupTitle }: SaveAsTemplateButtonProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(signupTitle)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await saveSignupAsTemplate(signupId, title.trim())
      if (!result.ok) {
        setError("Something went wrong — try again.")
        return
      }
      setOpen(false)
      setSaved(true)
    })
  }

  if (saved) {
    return <span className="text-sm text-muted-foreground">Saved as template.</span>
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Save as template
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Template title"
          value={title}
          disabled={isPending}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button size="sm" disabled={isPending || title.trim() === ""} onClick={submit}>
          {isPending ? "Saving…" : "Save template"}
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
