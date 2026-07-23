"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addSlot, deleteSlot, updateSlot } from "@/features/signups/actions"

const ERROR_MESSAGES: Record<string, string> = {
  signup_not_editable: "Slots can't be edited once the signup is closed.",
  slot_has_claims: "This slot has claims — it can't be deleted.",
  capacity_below_claims: "Capacity can't be lower than the seats already claimed.",
  invalid_input: "Check the values — label required, points ≥ 0, capacity ≥ 1.",
}

function message(code: string): string {
  return ERROR_MESSAGES[code] ?? "Something went wrong — try again."
}

export interface EditableSlot {
  id: string
  label: string
  pointValue: number
  capacity: number
  claimedCount: number
}

interface SlotFieldsProps {
  idPrefix: string
  label: string
  pointValue: number
  capacity: number
  disabled: boolean
  onChange(fields: { label: string; pointValue: number; capacity: number }): void
}

function SlotFields({
  idPrefix,
  label,
  pointValue,
  capacity,
  disabled,
  onChange,
}: SlotFieldsProps) {
  return (
    <>
      <div className="min-w-0 grow">
        <Label htmlFor={`${idPrefix}-label`} className="text-xs">
          Label
        </Label>
        <Input
          id={`${idPrefix}-label`}
          value={label}
          disabled={disabled}
          onChange={(e) => onChange({ label: e.target.value, pointValue, capacity })}
        />
      </div>
      <div className="w-20">
        <Label htmlFor={`${idPrefix}-points`} className="text-xs">
          Points
        </Label>
        <Input
          id={`${idPrefix}-points`}
          type="number"
          min={0}
          value={pointValue}
          disabled={disabled}
          onChange={(e) => onChange({ label, pointValue: Number(e.target.value), capacity })}
        />
      </div>
      <div className="w-20">
        <Label htmlFor={`${idPrefix}-capacity`} className="text-xs">
          Seats
        </Label>
        <Input
          id={`${idPrefix}-capacity`}
          type="number"
          min={1}
          value={capacity}
          disabled={disabled}
          onChange={(e) => onChange({ label, pointValue, capacity: Number(e.target.value) })}
        />
      </div>
    </>
  )
}

function SlotEditorRow({ slot }: { slot: EditableSlot }) {
  const [fields, setFields] = useState({
    label: slot.label,
    pointValue: slot.pointValue,
    capacity: slot.capacity,
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setError(message(result.error ?? ""))
    })
  }

  const dirty =
    fields.label !== slot.label ||
    fields.pointValue !== slot.pointValue ||
    fields.capacity !== slot.capacity

  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-end gap-2">
        <SlotFields
          idPrefix={`slot-${slot.id}`}
          {...fields}
          disabled={isPending}
          onChange={setFields}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || !dirty}
          onClick={() => run(() => updateSlot(slot.id, fields))}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending || slot.claimedCount > 0}
          title={slot.claimedCount > 0 ? "Slot has claims and can't be deleted" : undefined}
          onClick={() => run(() => deleteSlot(slot.id))}
        >
          Delete
        </Button>
      </div>
      {slot.claimedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {slot.claimedCount} seat{slot.claimedCount === 1 ? "" : "s"} claimed — capacity can&apos;t
          go below that.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  )
}

const EMPTY_SLOT = { label: "", pointValue: 1, capacity: 1 }

function AddSlotRow({ signupId }: { signupId: string }) {
  const [fields, setFields] = useState(EMPTY_SLOT)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <li className="space-y-1 border-t pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <SlotFields idPrefix="slot-new" {...fields} disabled={isPending} onChange={setFields} />
        <Button
          size="sm"
          disabled={isPending || fields.label.trim() === ""}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const result = await addSlot(signupId, fields)
              if (!result.ok) setError(message(result.error))
              else setFields(EMPTY_SLOT)
            })
          }}
        >
          {isPending ? "Adding…" : "Add slot"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  )
}

// Admin slot management for draft/open signups — separate from the volunteer
// slot table so the claim surface stays uncluttered.
export function SlotEditor({ signupId, slots }: { signupId: string; slots: EditableSlot[] }) {
  return (
    <section className="rounded-lg border p-4">
      <h2 className="text-sm font-medium">Manage slots</h2>
      <ul className="mt-3 space-y-3">
        {slots.map((slot) => (
          <SlotEditorRow key={slot.id} slot={slot} />
        ))}
        <AddSlotRow signupId={signupId} />
      </ul>
    </section>
  )
}
