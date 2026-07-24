import { z } from "zod"

// Redeeming an invite creates a plain org member (no OrgRole, no
// TeamMembership — see REAL_AUTH_IMPLEMENTATION.md Decision 5). authId comes
// from the just-created Supabase account, not client-chosen.
export const inviteRedeemInputSchema = z.object({
  token: z.string().min(1),
  authId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
})
export type InviteRedeemInput = z.infer<typeof inviteRedeemInputSchema>

export const inviteValidateResponseSchema = z.object({ org_id: z.string(), org_name: z.string() })
export type InviteValidateResponse = z.infer<typeof inviteValidateResponseSchema>
