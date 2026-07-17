import { z } from "zod"
import { slotResponseStatusSchema } from "./enums"

// slot_id/user_id/team_id come from context (which slot, which user, which
// team gets the points) — status/rank are the actual input fields.
export const slotResponseSchema = z.object({
  status: slotResponseStatusSchema.default("pending"),
  rank: z.number().int().positive().nullable().optional(),
})
export type SlotResponseInput = z.infer<typeof slotResponseSchema>

// Body of POST /slots/:slotId/responses (DIRECT_CLAIM): the volunteer only
// chooses which of their teams gets the points — slot comes from the URL,
// user from the session, status is always `pending` server-side.
export const slotClaimSchema = z.object({
  teamId: z.string().min(1),
})
export type SlotClaimInput = z.infer<typeof slotClaimSchema>
