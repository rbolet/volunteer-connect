import { z } from "zod"
import { signupModeSchema, signupStatusSchema, teamRoleSchema } from "./enums"

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
