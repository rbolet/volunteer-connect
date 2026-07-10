import { z } from "zod"

export const eventSchema = z.object({
  name: z.string().min(1),
  eventDate: z.date(),
})
export type EventInput = z.infer<typeof eventSchema>
