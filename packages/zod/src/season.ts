import { z } from "zod"

export const seasonSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().default(false),
})
export type SeasonInput = z.infer<typeof seasonSchema>
