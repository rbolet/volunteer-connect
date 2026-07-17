import type {
  ResolvedSession,
  SignupMode,
  SignupStatus,
  SlotResponseStatus,
  TeamRole,
} from "@vc/types"

// Pure business rules for claiming/withdrawing DIRECT_CLAIM slots
// (DATA_MODEL.md → Signup Lifecycle + Permission Matrix). Kept free of Prisma
// so every branch is unit-testable; the repository evaluates these inside its
// transaction with freshly-read state.

export type ClaimRejection =
  | "slot_not_found"
  | "wrong_mode"
  | "signup_not_open"
  | "not_eligible"
  | "not_your_team"
  | "already_claimed"
  | "slot_full"

export interface ClaimContext {
  slot: {
    capacity: number
    claimedCount: number
    signup: { status: SignupStatus; mode: SignupMode; eligibleRoles: TeamRole[] }
  } | null
  session: ResolvedSession
  teamId: string
  alreadyClaimed: boolean
}

export function evaluateClaim(ctx: ClaimContext): ClaimRejection | "ok" {
  if (!ctx.slot) return "slot_not_found"
  const { signup } = ctx.slot
  if (signup.mode !== "DIRECT_CLAIM") return "wrong_mode"
  if (signup.status !== "open") return "signup_not_open"
  if (!ctx.session.team_roles.some((t) => signup.eligibleRoles.includes(t.role))) {
    return "not_eligible"
  }
  // Points must go to a team the responder actually belongs to.
  if (!ctx.session.team_roles.some((t) => t.team_id === ctx.teamId)) return "not_your_team"
  // Duplicate check before capacity so re-claiming a full slot you're already
  // on reads as "already claimed", not "full".
  if (ctx.alreadyClaimed) return "already_claimed"
  if (ctx.slot.claimedCount >= ctx.slot.capacity) return "slot_full"
  return "ok"
}

export type WithdrawRejection = "not_found" | "not_owner" | "signup_not_open" | "not_pending"

export interface WithdrawContext {
  response: {
    userId: string
    status: SlotResponseStatus
    signupStatus: SignupStatus
  } | null
  session: ResolvedSession
}

// Volunteers withdraw by deleting their own response while the signup is
// `open` (DATA_MODEL.md). Anything already assigned/completed/declined is an
// admin concern, not self-service.
export function evaluateWithdraw(ctx: WithdrawContext): WithdrawRejection | "ok" {
  if (!ctx.response) return "not_found"
  if (ctx.response.userId !== ctx.session.user_id) return "not_owner"
  if (ctx.response.signupStatus !== "open") return "signup_not_open"
  if (ctx.response.status !== "pending") return "not_pending"
  return "ok"
}
