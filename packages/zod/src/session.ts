import { z } from "zod"
import { orgRoleTypeSchema, teamRoleSchema } from "./enums"

// ResolvedSession — the payload every SessionResolver implementation produces
// and the shape forwarded to Express via the trusted BFF header (AUTH.md).
// snake_case deliberately, unlike the camelCase *Input schemas: this is the
// cross-layer wire payload spec'd in AUTH.md, not client form input.
export const resolvedSessionSchema = z.object({
  user_id: z.string().min(1),
  org_id: z.string().min(1),
  org_roles: z.array(orgRoleTypeSchema),
  team_roles: z.array(
    z.object({
      team_id: z.string().min(1),
      role: teamRoleSchema,
    })
  ),
  source: z.enum(["supabase", "demo"]),
})
export type ResolvedSession = z.infer<typeof resolvedSessionSchema>

// The fixed set of identities DemoSessionResolver may impersonate
// (DEMO_MODE.md): one per TeamRole plus the org admin. Never a free-form user
// id. Values = "admin" + teamRoleSchema's values — keep in sync by hand.
export const demoIdentitySchema = z.enum(["admin", "head_coach", "coach", "referee", "volunteer"])
export type DemoIdentity = z.infer<typeof demoIdentitySchema>

// Base response shared by every internal (BFF-secret-guarded) session
// endpoint: the resolved session plus the display fields pages need.
export const appSessionResponseSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
  }),
  session: resolvedSessionSchema,
})
export type AppSessionResponse = z.infer<typeof appSessionResponseSchema>

// Response of the internal demo-session endpoint — appSessionResponseSchema
// plus the identity the demo banner/switcher needs.
export const demoSessionResponseSchema = appSessionResponseSchema.extend({
  identity: demoIdentitySchema,
})
export type DemoSessionResponse = z.infer<typeof demoSessionResponseSchema>
