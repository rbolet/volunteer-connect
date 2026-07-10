import { z } from "zod"

// Fields only — excludes id/audit fields (created_at, updated_by, etc.), which
// are system-managed, not part of any create/seed input. See DATA_MODEL.md.
export const organizationSchema = z.object({
  name: z.string().min(1),
  isDemo: z.boolean().default(false),
})
export type OrganizationInput = z.infer<typeof organizationSchema>
