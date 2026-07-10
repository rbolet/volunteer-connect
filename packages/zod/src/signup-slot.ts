import { z } from "zod"

export const signupSlotSchema = z.object({
  label: z.string().min(1),
  pointValue: z.number().int().min(0).default(0),
  capacity: z.number().int().min(1).default(1),
})
export type SignupSlotInput = z.infer<typeof signupSlotSchema>
