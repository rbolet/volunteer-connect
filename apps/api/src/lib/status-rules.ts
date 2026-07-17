import type { SignupStatus } from "@vc/types"

// Pure lifecycle rules for admin signup management (DATA_MODEL.md → Signup
// Lifecycle), same pattern as claim-rules.ts: no Prisma, every branch
// unit-testable; repositories evaluate these inside their transactions.

// draft→open, open→closed, closed→open (reopen), closed→finalized.
// Finalized is terminal — un-finalizing would mean clawing back awarded
// points (deliberately unsupported).
const ALLOWED_TRANSITIONS: Record<SignupStatus, readonly SignupStatus[]> = {
  draft: ["open"],
  open: ["closed"],
  closed: ["open", "finalized"],
  finalized: [],
}

export type StatusChangeRejection = "invalid_transition"

export function evaluateStatusChange(
  current: SignupStatus,
  target: SignupStatus
): StatusChangeRejection | "ok" {
  return ALLOWED_TRANSITIONS[current].includes(target) ? "ok" : "invalid_transition"
}

export type SlotEditRejection = "signup_not_editable" | "slot_has_claims" | "capacity_below_claims"

export interface SlotEditContext {
  signupStatus: SignupStatus
  /** Non-declined responses currently on the slot (0 for a new slot). */
  claimedCount: number
  action: "add" | "update" | "delete"
  /** Required for updates — the capacity being written. */
  newCapacity?: number
}

// Slots are editable while a signup is draft or open; while open, edits may
// never strand existing claims (no deleting a claimed slot, no shrinking
// capacity below the claimed count).
export function evaluateSlotEdit(ctx: SlotEditContext): SlotEditRejection | "ok" {
  if (ctx.signupStatus !== "draft" && ctx.signupStatus !== "open") return "signup_not_editable"
  if (ctx.action === "delete" && ctx.claimedCount > 0) return "slot_has_claims"
  if (
    ctx.action === "update" &&
    ctx.newCapacity !== undefined &&
    ctx.newCapacity < ctx.claimedCount
  ) {
    return "capacity_below_claims"
  }
  return "ok"
}
