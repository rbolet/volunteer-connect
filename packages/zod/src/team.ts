import { z } from "zod"

// `teamNumber`/`name` are display labels, not identifiers — neither is
// DB-unique (see DATA_MODEL.md). Never validate/assume uniqueness here.
export const teamSchema = z.object({
  name: z.string().min(1),
  teamNumber: z.number().int().positive().nullable().optional(),
  color: z.string().min(1).nullable().optional(),
})
export type TeamInput = z.infer<typeof teamSchema>
