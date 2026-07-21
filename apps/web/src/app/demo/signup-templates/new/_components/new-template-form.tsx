"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { TeamRole } from "@vc/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createSignupTemplate } from "../../../actions"

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "volunteer", label: "Volunteer" },
  { value: "coach", label: "Coach" },
  { value: "head_coach", label: "Head Coach" },
  { value: "referee", label: "Referee" },
]

interface SlotDraft {
  label: string
  pointValue: number
  capacity: number
}

const EMPTY_SLOT: SlotDraft = { label: "", pointValue: 1, capacity: 1 }

// Builds a reusable template from scratch (see NewSignupForm for the
// equivalent signup-creation flow this mirrors).
export function NewTemplateForm() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [roles, setRoles] = useState<TeamRole[]>(["volunteer"])
  const [slots, setSlots] = useState<SlotDraft[]>([{ ...EMPTY_SLOT }])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleRole(role: TeamRole, checked: boolean) {
    setRoles((prev) => (checked ? [...prev, role] : prev.filter((r) => r !== role)))
  }

  function setSlot(index: number, patch: Partial<SlotDraft>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const valid =
    title.trim() !== "" &&
    roles.length > 0 &&
    slots.length > 0 &&
    slots.every((s) => s.label.trim() !== "")

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await createSignupTemplate({
        title: title.trim(),
        description: description.trim() === "" ? null : description.trim(),
        eligibleRoles: roles,
        slots,
      })
      if (!result.ok) {
        setError("Something went wrong — check the form and try again.")
        return
      }
      router.push("/demo/signup-templates")
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="template-title">Title</Label>
        <Input
          id="template-title"
          value={title}
          placeholder="e.g. Saturday Tent Duty"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-description">Description (optional)</Label>
        <Textarea
          id="template-description"
          value={description}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Who can respond</legend>
        <div className="flex flex-wrap gap-4">
          {ROLE_OPTIONS.map((role) => (
            <div key={role.value} className="flex items-center gap-2">
              <Checkbox
                id={`template-role-${role.value}`}
                checked={roles.includes(role.value)}
                onCheckedChange={(checked) => toggleRole(role.value, checked === true)}
              />
              <Label htmlFor={`template-role-${role.value}`}>{role.label}</Label>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Slots</legend>
        {slots.map((slot, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 grow">
              <Label htmlFor={`template-slot-${index}-label`} className="text-xs">
                Label
              </Label>
              <Input
                id={`template-slot-${index}-label`}
                value={slot.label}
                placeholder="e.g. Tent 8:00–10:00 AM"
                onChange={(e) => setSlot(index, { label: e.target.value })}
              />
            </div>
            <div className="w-20">
              <Label htmlFor={`template-slot-${index}-points`} className="text-xs">
                Points
              </Label>
              <Input
                id={`template-slot-${index}-points`}
                type="number"
                min={0}
                value={slot.pointValue}
                onChange={(e) => setSlot(index, { pointValue: Number(e.target.value) })}
              />
            </div>
            <div className="w-20">
              <Label htmlFor={`template-slot-${index}-capacity`} className="text-xs">
                Seats
              </Label>
              <Input
                id={`template-slot-${index}-capacity`}
                type="number"
                min={1}
                value={slot.capacity}
                onChange={(e) => setSlot(index, { capacity: Number(e.target.value) })}
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={slots.length === 1}
              aria-label={`Remove slot ${index + 1}`}
              onClick={() => setSlots((prev) => prev.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSlots((prev) => [...prev, { ...EMPTY_SLOT }])}
        >
          Add another slot
        </Button>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button disabled={!valid || isPending} onClick={submit}>
          {isPending ? "Saving…" : "Save template"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
