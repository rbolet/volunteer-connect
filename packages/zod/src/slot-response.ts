import { z } from "zod"
import { slotResponseStatusSchema } from "./enums"

// slot_id/user_id/team_id come from context (which slot, which user, which
// team gets the points) — status/rank are the actual input fields.
export const slotResponseSchema = z.object({
  status: slotResponseStatusSchema.default("pending"),
  rank: z.number().int().positive().nullable().optional(),
})
export type SlotResponseInput = z.infer<typeof slotResponseSchema>
