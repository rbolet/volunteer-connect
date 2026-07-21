import { z } from "zod"
import { teamRoleSchema } from "./enums"
import { signupSlotSchema } from "./signup-slot"

// SignupTemplate.slots/eligibleRoles are stored as JSON columns (see
// schema.prisma) rather than relational children. These are the only
// schemas that should ever parse/serialize those columns — kept here so a
// future move to relational tables only touches the templates repo, not
// every caller.
export const signupTemplateSlotSchema = signupSlotSchema
export type SignupTemplateSlot = z.infer<typeof signupTemplateSlotSchema>

export const signupTemplateEligibleRolesSchema = z.array(teamRoleSchema).min(1)

// Body of POST /signup-templates (blank builder).
export const createSignupTemplateSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  eligibleRoles: signupTemplateEligibleRolesSchema,
  slots: z.array(signupTemplateSlotSchema).min(1),
})
export type CreateSignupTemplateInput = z.infer<typeof createSignupTemplateSchema>

// Body of POST /signups/:id/save-as-template. description/eligibleRoles/slots
// are derived server-side from the source signup, not client-supplied.
export const saveSignupAsTemplateSchema = z.object({
  title: z.string().min(1),
})
export type SaveSignupAsTemplateInput = z.infer<typeof saveSignupAsTemplateSchema>
