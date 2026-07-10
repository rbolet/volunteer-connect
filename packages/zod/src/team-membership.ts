import { z } from "zod"
import { teamRoleSchema } from "./enums"

// user_id/team_id come from context (which user, which team) — role is the
// only actual input for a membership.
export const teamMembershipSchema = z.object({
  role: teamRoleSchema,
})
export type TeamMembershipInput = z.infer<typeof teamMembershipSchema>
