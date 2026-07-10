import { z } from "zod"
import { orgRoleTypeSchema } from "./enums"

// user_id/org_id come from context (which user, which org) — role is the
// only actual input for granting an org-level role.
export const orgRoleSchema = z.object({
  role: orgRoleTypeSchema,
})
export type OrgRoleInput = z.infer<typeof orgRoleSchema>
