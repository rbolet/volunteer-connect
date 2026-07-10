import { z } from "zod"

// Mirrors packages/db/prisma/schema.prisma's enums by value, deliberately not
// by import — this package has no dependency on @prisma/client (or @vc/db)
// so it stays usable from apps/web without pulling Prisma into the frontend
// bundle. Keep these string values in sync with schema.prisma by hand.

export const orgRoleTypeSchema = z.enum(["admin"])
export type OrgRoleType = z.infer<typeof orgRoleTypeSchema>

export const teamRoleSchema = z.enum(["head_coach", "coach", "referee", "volunteer"])
export type TeamRole = z.infer<typeof teamRoleSchema>

export const signupModeSchema = z.enum(["RANKED_CHOICE", "DIRECT_CLAIM"])
export type SignupMode = z.infer<typeof signupModeSchema>

export const signupStatusSchema = z.enum(["draft", "open", "closed", "finalized"])
export type SignupStatus = z.infer<typeof signupStatusSchema>

export const slotResponseStatusSchema = z.enum(["pending", "assigned", "declined", "completed"])
export type SlotResponseStatus = z.infer<typeof slotResponseStatusSchema>
