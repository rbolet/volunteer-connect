"use client"

import { useState, useTransition } from "react"
import type { SignupStatus } from "@vc/types"
import { Button } from "@/components/ui/button"
import { changeSignupStatus } from "../../../actions"

export interface AwardSummary {
  total: number
  perTeam: { teamName: string; points: number }[]
}

export interface AdminStatusControlsProps {
  signupId: string
  status: SignupStatus
  /** What finalizing would award right now — computed server-side. */
  awardSummary: AwardSummary
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_transition: "That status change isn't allowed anymore — reload the page.",
}

export function AdminStatusControls({ signupId, status, awardSummary }: AdminStatusControlsProps) {
  const [confirmingFinalize, setConfirmingFinalize] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function transition(target: "open" | "closed" | "finalized") {
    setError(null)
    startTransition(async () => {
      const result = await changeSignupStatus(signupId, target)
      if (!result.ok) {
        setError(ERROR_MESSAGES[result.error] ?? "Something went wrong — try again.")
      }
      setConfirmingFinalize(false)
    })
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Admin</span>
        {status === "draft" && (
          <Button size="sm" disabled={isPending} onClick={() => transition("open")}>
            Open signup
          </Button>
        )}
        {status === "open" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => transition("closed")}
          >
            Close signup
          </Button>
        )}
        {status === "closed" && !confirmingFinalize && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => transition("open")}
            >
              Reopen
            </Button>
            <Button size="sm" disabled={isPending} onClick={() => setConfirmingFinalize(true)}>
              Finalize &amp; award points…
            </Button>
          </>
        )}
        {status === "closed" && confirmingFinalize && (
          <>
            <span className="text-sm text-muted-foreground">
              {awardSummary.total === 0
                ? "No claims to award — finalize anyway?"
                : `Award ${awardSummary.total} pts (${awardSummary.perTeam
                    .map((t) => `${t.teamName} +${t.points}`)
                    .join(", ")})?`}
            </span>
            <Button size="sm" disabled={isPending} onClick={() => transition("finalized")}>
              {isPending ? "Finalizing…" : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirmingFinalize(false)}
            >
              Cancel
            </Button>
          </>
        )}
        {status === "finalized" && (
          <span className="text-sm text-muted-foreground">
            Finalized — points awarded, volunteers are view-only.
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
