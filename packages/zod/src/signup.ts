import { z } from "zod"
import { signupModeSchema, signupStatusSchema, teamRoleSchema } from "./enums"
import { signupSlotSchema } from "./signup-slot"

// One schema shared by real create-input validation, seed data, and test
// fixtures (see TESTING.md / DEMO_MODE.md's "three consumers" design) —
// narrow it with .omit()/.pick() at the point of use rather than declaring a
// second parallel schema (e.g. a public "create signup" endpoint that
// shouldn't accept a caller-supplied `status` can do
// `signupSchema.omit({ status: true })`).
export const signupSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  mode: signupModeSchema,
  status: signupStatusSchema.default("draft"),
  opensAt: z.date().nullable().optional(),
  closesAt: z.date().nullable().optional(),
  eligibleRoles: z.array(teamRoleSchema).min(1),
})
export type SignupInput = z.infer<typeof signupSchema>

// Body of POST /signups (admin). mode/status are server-set (DIRECT_CLAIM /
// draft — RANKED_CHOICE has no volunteer flow yet), season comes from the
// active season, so the client supplies only content + at least one slot.
export const createSignupSchema = signupSchema.pick({ title: true, eligibleRoles: true }).extend({
  description: z.string().nullable().optional(),
  slots: z.array(signupSlotSchema).min(1),
})
export type CreateSignupInput = z.infer<typeof createSignupSchema>

// Body of PATCH /signups/:id/status — `draft` is never a target state.
export const signupStatusChangeSchema = z.object({
  status: signupStatusSchema.exclude(["draft"]),
})
export type SignupStatusChangeInput = z.infer<typeof signupStatusChangeSchema>
