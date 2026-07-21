import { z } from "zod"
import { signupSchema } from "./signup"
import { signupSlotSchema } from "./signup-slot"
import { signupTemplateEligibleRolesSchema, signupTemplateSlotSchema } from "./signup-template"
import { teamSchema } from "./team"
import { signupStatusSchema, slotResponseStatusSchema, teamRoleSchema } from "./enums"

// Response/view-model schemas (see CROSSCONTEXT_TODOS.md) — purpose-built per
// screen, composed from the *Input building blocks rather than hand-duplicated.
// Datetimes cross the wire as ISO strings (JSON), unlike the z.date() fields
// on the *Input schemas which validate in-process values.

const isoDateTime = z.string().datetime()

// --- Signups ---------------------------------------------------------------

// List view: enough to render a card/row + fill state, no per-slot detail.
export const signupListItemSchema = signupSchema.pick({ title: true, mode: true }).extend({
  id: z.string().min(1),
  status: signupStatusSchema,
  description: z.string().nullable(),
  opensAt: isoDateTime.nullable(),
  closesAt: isoDateTime.nullable(),
  eligibleRoles: z.array(teamRoleSchema),
  eventName: z.string().nullable(),
  // Seats = sum of slot capacities; claimed = non-declined responses.
  totalSeats: z.number().int().min(0),
  claimedSeats: z.number().int().min(0),
})
export type SignupListItem = z.infer<typeof signupListItemSchema>

export const slotResponseViewSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  teamNumber: z.number().int().nullable(),
  status: slotResponseStatusSchema,
  rank: z.number().int().nullable(),
})
export type SlotResponseView = z.infer<typeof slotResponseViewSchema>

// `claimedCount` is the full (non-declined) response count — kept separate
// from `responses`, which the API redacts to "own only" while a signup is
// open/closed (permission matrix), so slot fullness stays computable.
export const signupSlotViewSchema = signupSlotSchema.extend({
  id: z.string().min(1),
  claimedCount: z.number().int().min(0),
  responses: z.array(slotResponseViewSchema),
})
export type SignupSlotView = z.infer<typeof signupSlotViewSchema>

// Detail view: list item + full slot/response breakdown.
export const signupDetailSchema = signupListItemSchema.extend({
  slots: z.array(signupSlotViewSchema),
})
export type SignupDetail = z.infer<typeof signupDetailSchema>

// --- Signup templates --------------------------------------------------------

// Returns full content, not a lean summary — template counts are small for a
// pilot-scale org, so the picker can populate the New Signup form straight
// from the list response with no second fetch.
export const signupTemplateListItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  eligibleRoles: signupTemplateEligibleRolesSchema,
  slots: z.array(signupTemplateSlotSchema),
})
export type SignupTemplateListItem = z.infer<typeof signupTemplateListItemSchema>

// --- Teams -----------------------------------------------------------------

// totalPoints is computed (SUM over points_ledger) — deliberately never stored.
export const teamWithPointsSchema = teamSchema.extend({
  id: z.string().min(1),
  totalPoints: z.number().int().min(0),
  memberCount: z.number().int().min(0),
})
export type TeamWithPoints = z.infer<typeof teamWithPointsSchema>

// --- Current user's responses (dashboard "my claims") -----------------------

export const myResponseViewSchema = z.object({
  id: z.string().min(1),
  status: slotResponseStatusSchema,
  slotId: z.string().min(1),
  slotLabel: z.string().min(1),
  pointValue: z.number().int().min(0),
  signupId: z.string().min(1),
  signupTitle: z.string().min(1),
  signupStatus: signupStatusSchema,
  teamId: z.string().min(1),
  teamName: z.string().min(1),
})
export type MyResponseView = z.infer<typeof myResponseViewSchema>
