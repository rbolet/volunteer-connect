import { z } from "zod"

// Excludes org_id/auth_id — both are set by the system (org from context,
// auth_id from the Supabase session), never client/seed input.
export const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})
export type UserInput = z.infer<typeof userSchema>
