"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { claimSlot, withdrawResponse } from "@/features/signups/actions"

const ERROR_MESSAGES: Record<string, string> = {
  slot_full: "This slot just filled up.",
  already_claimed: "You already claimed this slot.",
  signup_not_open: "This signup is no longer open.",
  not_eligible: "Your role isn't eligible for this signup.",
  not_your_team: "Pick one of your own teams.",
}

export interface ClaimCellProps {
  slotId: string
  signupOpen: boolean
  eligible: boolean
  seatsLeft: number
  /** The current user's own response on this slot, if any. */
  myResponse: { id: string; status: string } | null
  /** Teams the current user may assign points to (their memberships). */
  myTeams: { id: string; name: string }[]
}

export function ClaimCell({
  slotId,
  signupOpen,
  eligible,
  seatsLeft,
  myResponse,
  myTeams,
}: ClaimCellProps) {
  const [error, setError] = useState<string | null>(null)
  const [teamId, setTeamId] = useState(myTeams[0]?.id ?? "")
  const [isPending, startTransition] = useTransition()
  // myTeams can change under a mounted cell (the demo identity switcher swaps
  // the session without remounting the page) — never claim with a stale or
  // empty selection.
  const effectiveTeamId = myTeams.some((t) => t.id === teamId) ? teamId : (myTeams[0]?.id ?? "")

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(ERROR_MESSAGES[result.error ?? ""] ?? "Something went wrong — try again.")
      }
    })
  }

  if (myResponse) {
    if (signupOpen && myResponse.status === "pending") {
      const responseId = myResponse.id
      return (
        <div className="flex flex-col items-end gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => withdrawResponse(responseId))}
          >
            {isPending ? "Withdrawing…" : "Withdraw"}
          </Button>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )
    }
    return <span className="text-sm text-muted-foreground">Yours</span>
  }

  if (!signupOpen) return <span className="text-sm text-muted-foreground">—</span>
  if (!eligible) return <span className="text-sm text-muted-foreground">Not eligible</span>
  if (seatsLeft <= 0) return <span className="text-sm text-muted-foreground">Full</span>
  if (myTeams.length === 0) return <span className="text-sm text-muted-foreground">—</span>

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {myTeams.length > 1 && (
          <select
            aria-label="Team to credit"
            className="h-7 rounded-md border bg-background px-1.5 text-xs"
            value={effectiveTeamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={isPending}
          >
            {myTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <Button
          size="sm"
          disabled={isPending || effectiveTeamId === ""}
          onClick={() => run(() => claimSlot(slotId, effectiveTeamId))}
        >
          {isPending ? "Claiming…" : "Claim"}
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
