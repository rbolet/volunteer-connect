import type {
  EventInput,
  OrganizationInput,
  OrgRoleType,
  SeasonInput,
  SignupInput,
  SignupSlotInput,
  SlotResponseInput,
  TeamInput,
  TeamRole,
  UserInput,
} from "@vc/types"

/**
 * Curated (hand-authored, not faker-generated) content for the public demo org.
 * This file holds *what the demo contains* — org/season/team/user/event/signup
 * content and the planned slot-response outcomes. It intentionally has no
 * Prisma calls and no DB writes: the builders/scenario code that turns this
 * into real rows (resolving the string keys below into actual foreign keys)
 * is a separate, later step so the content itself can be reviewed on its own
 * first.
 *
 * The game-weekend signups below are modeled on a real AYSO region's tent-duty
 * and field-lining sign-up sheet (hourly shifts, two seats per shift, a point
 * bonus on the bookend shifts, and — deliberately preserved — realistic gaps
 * where afternoon shifts go unfilled).
 *
 * Conventions:
 * - All emails use the reserved example.com domain (never deliverable/real).
 * - `authId` is a synthetic placeholder (`demo-auth-<key>`) since demo users
 *   are never authenticated via real Supabase Auth (see AUTH.md's DemoSessionResolver) —
 *   it only exists to satisfy User.auth_id's NOT NULL/UNIQUE constraint.
 * - `key` fields (on teams/users/events/signups/slots) are pure cross-reference
 *   tokens for this file and the generator that will consume it — they are
 *   NOT derived from any "real" field, because nothing on Team or User is
 *   actually DB-unique (see DATA_MODEL.md: team_number/name aren't unique;
 *   User.email isn't @unique in the schema either, only auth_id is).
 * - Event/season dates are computed from the real current year (not a
 *   hardcoded year) so the demo doesn't look stale in future years — see
 *   `currentYear`/`eventFriday`/`eventSaturday` below.
 * - PointsLedger rows are NOT hand-specified here — the generation step derives
 *   one automatically for every SlotResponse with status "completed" (points =
 *   the slot's pointValue, awardedBy = the demo admin), to avoid hand-duplicating
 *   a value that's already implied by the slot + response status.
 */

// ---------------------------------------------------------------------------
// Dates — computed from the real current year so the demo stays evergreen.
// Picks the 2nd Saturday of October as the game day, Friday before as prep day.
// ---------------------------------------------------------------------------

function nthWeekdayOfMonth(year: number, monthIndex0: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, monthIndex0, 1))
  const firstWeekday = first.getUTCDay()
  const offset = (weekday - firstWeekday + 7) % 7
  const day = 1 + offset + (n - 1) * 7
  return new Date(Date.UTC(year, monthIndex0, day))
}

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

/** "Oct 9–10" when both dates share a month, "Oct 30–Nov 1" otherwise. */
function formatDateRange(start: Date, end: Date): string {
  const sameMonth = start.getUTCMonth() === end.getUTCMonth()
  const endLabel = sameMonth ? String(end.getUTCDate()) : formatMonthDay(end)
  return `${formatMonthDay(start)}–${endLabel}`
}

const OCTOBER = 9
const SATURDAY = 6

export const currentYear = new Date().getFullYear()
export const eventSaturday = nthWeekdayOfMonth(currentYear, OCTOBER, SATURDAY, 2)
export const eventFriday = new Date(eventSaturday)
eventFriday.setUTCDate(eventSaturday.getUTCDate() - 1)

export const demoOrganization: OrganizationInput = {
  name: "AYSO 1463 Temecula/Murrieta",
  // Explicit rather than relying on the schema's default — this literal *is*
  // the demo org, so it should never be ambiguous about that.
  isDemo: true,
}

export const demoSeason: SeasonInput = {
  name: `Fall ${currentYear}`,
  isActive: true,
}

export type DemoTeam = TeamInput & { key: string }

export const demoTeams: DemoTeam[] = [
  { key: "sharks", name: "Sharks", teamNumber: 351, color: "Blue" },
  { key: "comets", name: "Comets", teamNumber: 502, color: "Red" },
  { key: "thunder", name: "Thunder", teamNumber: 552, color: "Green" },
  { key: "lightning", name: "Lightning", teamNumber: 305, color: "Yellow" },
  { key: "eagles", name: "Eagles", teamNumber: 356, color: "Orange" },
  { key: "wildcats", name: "Wildcats", teamNumber: 456, color: "Purple" },
]

/**
 * A user's `demoIdentity`, when set, marks it as one of the fixed, switchable
 * identities DemoSessionResolver is allowed to impersonate (AUTH.md / DEMO_MODE.md's
 * "view as Admin/Coach/Referee/Volunteer" switcher). Exactly one user per value.
 * Every other user below exists purely to populate rosters/signups realistically.
 */
export type DemoUser = UserInput & {
  key: string
  authId: string
  orgRole?: OrgRoleType
  memberships: { teamKey: string; role: TeamRole }[]
  demoIdentity?: "admin" | TeamRole
}

export const demoUsers: DemoUser[] = [
  // --- Fixed "view as" identities (5) ---
  {
    key: "demo_admin",
    name: "Carlos Torres",
    email: "carlos.torres@example.com",
    authId: "demo-auth-demo_admin",
    orgRole: "admin",
    memberships: [],
    demoIdentity: "admin",
  },
  {
    key: "demo_head_coach",
    name: "Marcus Chen",
    email: "marcus.chen@example.com",
    authId: "demo-auth-demo_head_coach",
    memberships: [{ teamKey: "sharks", role: "head_coach" }],
    demoIdentity: "head_coach",
  },
  {
    key: "demo_coach",
    name: "Priya Patel",
    email: "priya.patel@example.com",
    authId: "demo-auth-demo_coach",
    memberships: [{ teamKey: "comets", role: "coach" }],
    demoIdentity: "coach",
  },
  {
    key: "demo_referee",
    name: "Jordan Lee",
    email: "jordan.lee@example.com",
    authId: "demo-auth-demo_referee",
    memberships: [{ teamKey: "thunder", role: "referee" }],
    demoIdentity: "referee",
  },
  {
    key: "demo_volunteer",
    name: "Sam Rodriguez",
    email: "sam.rodriguez@example.com",
    authId: "demo-auth-demo_volunteer",
    memberships: [{ teamKey: "eagles", role: "volunteer" }],
    demoIdentity: "volunteer",
  },

  // --- Background roster: sharks (351) ---
  {
    key: "laura_kim",
    name: "Laura Kim",
    email: "laura.kim@example.com",
    authId: "demo-auth-laura_kim",
    memberships: [{ teamKey: "sharks", role: "coach" }],
  },
  {
    key: "james_wright",
    name: "James Wright",
    email: "james.wright@example.com",
    authId: "demo-auth-james_wright",
    memberships: [{ teamKey: "sharks", role: "volunteer" }],
  },
  {
    key: "nicole_baker",
    name: "Nicole Baker",
    email: "nicole.baker@example.com",
    authId: "demo-auth-nicole_baker",
    memberships: [{ teamKey: "sharks", role: "volunteer" }],
  },

  // --- Background roster: comets (502) ---
  {
    key: "angela_kim",
    name: "Angela Kim",
    email: "angela.kim@example.com",
    authId: "demo-auth-angela_kim",
    memberships: [{ teamKey: "comets", role: "head_coach" }],
  },
  {
    key: "maria_gonzalez",
    name: "Maria Gonzalez",
    email: "maria.gonzalez@example.com",
    authId: "demo-auth-maria_gonzalez",
    memberships: [{ teamKey: "comets", role: "volunteer" }],
  },
  {
    key: "steven_park",
    name: "Steven Park",
    email: "steven.park@example.com",
    authId: "demo-auth-steven_park",
    memberships: [{ teamKey: "comets", role: "volunteer" }],
  },

  // --- Background roster: thunder (552) ---
  {
    key: "robert_nguyen",
    name: "Robert Nguyen",
    email: "robert.nguyen@example.com",
    authId: "demo-auth-robert_nguyen",
    memberships: [{ teamKey: "thunder", role: "head_coach" }],
  },
  {
    key: "rachel_kim",
    name: "Rachel Kim",
    email: "rachel.kim@example.com",
    authId: "demo-auth-rachel_kim",
    memberships: [{ teamKey: "thunder", role: "volunteer" }],
  },
  {
    key: "derek_foster",
    name: "Derek Foster",
    email: "derek.foster@example.com",
    authId: "demo-auth-derek_foster",
    memberships: [{ teamKey: "thunder", role: "volunteer" }],
  },

  // --- Background roster: lightning (305) ---
  {
    key: "michelle_osei",
    name: "Michelle Osei",
    email: "michelle.osei@example.com",
    authId: "demo-auth-michelle_osei",
    memberships: [{ teamKey: "lightning", role: "head_coach" }],
  },
  {
    key: "carlos_mendoza",
    name: "Carlos Mendoza",
    email: "carlos.mendoza@example.com",
    authId: "demo-auth-carlos_mendoza",
    memberships: [{ teamKey: "lightning", role: "volunteer" }],
  },
  {
    key: "linda_zhao",
    name: "Linda Zhao",
    email: "linda.zhao@example.com",
    authId: "demo-auth-linda_zhao",
    memberships: [{ teamKey: "lightning", role: "volunteer" }],
  },
  {
    key: "tom_baker",
    name: "Tom Baker",
    email: "tom.baker@example.com",
    authId: "demo-auth-tom_baker",
    memberships: [{ teamKey: "lightning", role: "referee" }],
  },

  // --- Background roster: eagles (356) ---
  {
    key: "david_torres",
    name: "David Torres",
    email: "david.torres@example.com",
    authId: "demo-auth-david_torres",
    memberships: [{ teamKey: "eagles", role: "head_coach" }],
  },
  {
    key: "kevin_obrien",
    name: "Kevin O'Brien",
    email: "kevin.obrien@example.com",
    authId: "demo-auth-kevin_obrien",
    memberships: [{ teamKey: "eagles", role: "coach" }],
  },
  {
    key: "aisha_bello",
    name: "Aisha Bello",
    email: "aisha.bello@example.com",
    authId: "demo-auth-aisha_bello",
    memberships: [{ teamKey: "eagles", role: "volunteer" }],
  },

  // --- Background roster: wildcats (456) ---
  {
    key: "fatima_hassan",
    name: "Fatima Hassan",
    email: "fatima.hassan@example.com",
    authId: "demo-auth-fatima_hassan",
    memberships: [{ teamKey: "wildcats", role: "head_coach" }],
  },
  {
    key: "grace_lin",
    name: "Grace Lin",
    email: "grace.lin@example.com",
    authId: "demo-auth-grace_lin",
    memberships: [{ teamKey: "wildcats", role: "coach" }],
  },
  {
    key: "emily_davis",
    name: "Emily Davis",
    email: "emily.davis@example.com",
    authId: "demo-auth-emily_davis",
    memberships: [{ teamKey: "wildcats", role: "volunteer" }],
  },
  {
    key: "omar_farouk",
    name: "Omar Farouk",
    email: "omar.farouk@example.com",
    authId: "demo-auth-omar_farouk",
    memberships: [{ teamKey: "wildcats", role: "volunteer" }],
  },
  {
    key: "nina_alvarez",
    name: "Nina Alvarez",
    email: "nina.alvarez@example.com",
    authId: "demo-auth-nina_alvarez",
    memberships: [{ teamKey: "wildcats", role: "referee" }],
  },
]

/** Convenience view of the 5 fixed switcher identities — for the DemoSessionResolver, not DB writes. */
export const demoHeroUsers = demoUsers.filter((u) => u.demoIdentity)

/**
 * Groups the signups tied to one real-world occasion (see Event in DATA_MODEL.md).
 * A Signup's `eventKey` is optional in principle; every demo signup below happens
 * to belong to this one game weekend.
 */
export type DemoEvent = EventInput & { key: string }

export const demoEvents: DemoEvent[] = [
  {
    key: "fall_game_weekend",
    name: `Fall ${currentYear} Game Weekend — ${formatDateRange(eventFriday, eventSaturday)}`,
    eventDate: eventSaturday,
  },
]

export type DemoSlot = SignupSlotInput & { key: string }

export type DemoSignup = SignupInput & {
  key: string
  eventKey?: string
  slots: DemoSlot[]
}

// Modeled on a real AYSO region's tent-duty/field-lining sheet: hourly shifts,
// two seats per shift ("1st volunteer"/"2nd volunteer" -> capacity 2), and a
// 2-point bonus on the bookend shifts (the real sheet's rule: "Extended duty
// (7:15-8:00 AM or 3:00-4:00 PM): 2 points", standard shifts are 1 point/hour).
export const demoSignups: DemoSignup[] = [
  {
    key: "field_prep",
    eventKey: "fall_game_weekend",
    title: "Field Lining & Setup — Friday",
    description:
      "Pre-game field lining and goal setup for all six fields ahead of Saturday's games. Assumed 4:00-6:00 PM window (start time only was specified; flag if the real window differs).",
    mode: "DIRECT_CLAIM",
    status: "finalized",
    eligibleRoles: ["volunteer", "coach", "head_coach"],
    slots: [
      {
        key: "field_1",
        label: "Field 1 Lining & Setup (4:00–6:00 PM)",
        pointValue: 8,
        capacity: 2,
      },
      {
        key: "field_2",
        label: "Field 2 Lining & Setup (4:00–6:00 PM)",
        pointValue: 8,
        capacity: 2,
      },
      {
        key: "field_3",
        label: "Field 3 Lining & Setup (4:00–6:00 PM)",
        pointValue: 8,
        capacity: 2,
      },
      {
        key: "field_4",
        label: "Field 4 Lining & Setup (4:00–6:00 PM)",
        pointValue: 8,
        capacity: 2,
      },
      {
        key: "field_5",
        label: "Field 5 Lining & Setup (4:00–6:00 PM)",
        pointValue: 8,
        capacity: 2,
      },
      {
        key: "field_6",
        label: "Field 6 Lining & Setup (4:00–6:00 PM)",
        pointValue: 8,
        capacity: 2,
      },
    ],
  },
  {
    key: "board_tent",
    eventKey: "fall_game_weekend",
    title: "Board Tent Duty — Saturday",
    description:
      "Staffing the board tent — team check-in and volunteer point verification throughout the day.",
    mode: "DIRECT_CLAIM",
    status: "finalized",
    eligibleRoles: ["volunteer", "coach", "head_coach"],
    slots: [
      { key: "board_715_8", label: "Board Tent 7:15–8:00 AM", pointValue: 2, capacity: 2 },
      { key: "board_8_9", label: "Board Tent 8:00–9:00 AM", pointValue: 1, capacity: 2 },
      { key: "board_9_10", label: "Board Tent 9:00–10:00 AM", pointValue: 1, capacity: 2 },
      { key: "board_10_11", label: "Board Tent 10:00–11:00 AM", pointValue: 1, capacity: 2 },
      { key: "board_11_12", label: "Board Tent 11:00 AM–12:00 PM", pointValue: 1, capacity: 2 },
      { key: "board_12_1", label: "Board Tent 12:00–1:00 PM", pointValue: 1, capacity: 2 },
      { key: "board_1_2", label: "Board Tent 1:00–2:00 PM", pointValue: 1, capacity: 2 },
      { key: "board_2_3", label: "Board Tent 2:00–3:00 PM", pointValue: 1, capacity: 2 },
      { key: "board_3_4", label: "Board Tent 3:00–4:00 PM", pointValue: 2, capacity: 2 },
    ],
  },
  {
    key: "ref_tent",
    eventKey: "fall_game_weekend",
    title: "Referee Tent Duty — Saturday",
    description:
      "Staffing the referee tent — game assignments and referee check-in throughout the day.",
    mode: "DIRECT_CLAIM",
    status: "open",
    eligibleRoles: ["volunteer", "coach", "head_coach", "referee"],
    slots: [
      { key: "ref_8_9", label: "Ref Tent 8:00–9:00 AM", pointValue: 1, capacity: 2 },
      { key: "ref_9_10", label: "Ref Tent 9:00–10:00 AM", pointValue: 1, capacity: 2 },
      { key: "ref_10_11", label: "Ref Tent 10:00–11:00 AM", pointValue: 1, capacity: 2 },
      { key: "ref_11_12", label: "Ref Tent 11:00 AM–12:00 PM", pointValue: 1, capacity: 2 },
      { key: "ref_12_1", label: "Ref Tent 12:00–1:00 PM", pointValue: 1, capacity: 2 },
      { key: "ref_1_2", label: "Ref Tent 1:00–2:00 PM", pointValue: 1, capacity: 2 },
      { key: "ref_2_3", label: "Ref Tent 2:00–3:00 PM", pointValue: 1, capacity: 2 },
      { key: "ref_3_4", label: "Ref Tent 3:00–4:00 PM", pointValue: 2, capacity: 2 },
    ],
  },
]

export type DemoSlotResponse = SlotResponseInput & {
  signupKey: string
  slotKey: string
  userKey: string
  /** Which team gets the points if/when this response is completed. */
  teamKey: string
}

export const demoSlotResponses: DemoSlotResponse[] = [
  // --- field_prep (DIRECT_CLAIM, finalized) — 6 slots x capacity 2 ---
  {
    signupKey: "field_prep",
    slotKey: "field_1",
    userKey: "james_wright",
    teamKey: "sharks",
    status: "completed",
  },
  {
    signupKey: "field_prep",
    slotKey: "field_1",
    userKey: "nicole_baker",
    teamKey: "sharks",
    status: "completed",
  },
  {
    signupKey: "field_prep",
    slotKey: "field_2",
    userKey: "maria_gonzalez",
    teamKey: "comets",
    status: "completed",
  },
  {
    signupKey: "field_prep",
    slotKey: "field_2",
    userKey: "steven_park",
    teamKey: "comets",
    status: "completed",
  },
  {
    signupKey: "field_prep",
    slotKey: "field_3",
    userKey: "rachel_kim",
    teamKey: "thunder",
    status: "completed",
  },
  {
    signupKey: "field_prep",
    slotKey: "field_3",
    userKey: "derek_foster",
    teamKey: "thunder",
    status: "completed",
  },
  {
    signupKey: "field_prep",
    slotKey: "field_4",
    userKey: "carlos_mendoza",
    teamKey: "lightning",
    status: "completed",
  },
  {
    signupKey: "field_prep",
    slotKey: "field_4",
    userKey: "linda_zhao",
    teamKey: "lightning",
    status: "completed",
  },
  {
    signupKey: "field_prep",
    slotKey: "field_5",
    userKey: "aisha_bello",
    teamKey: "eagles",
    status: "completed",
  },
  {
    signupKey: "field_prep",
    slotKey: "field_5",
    userKey: "demo_volunteer",
    teamKey: "eagles",
    status: "completed",
  },
  // field_6 left with only 1 of 2 seats filled — a real signup rarely fills every last seat.
  {
    signupKey: "field_prep",
    slotKey: "field_6",
    userKey: "emily_davis",
    teamKey: "wildcats",
    status: "completed",
  },

  // --- board_tent (DIRECT_CLAIM, finalized) — morning fills up, afternoon doesn't,
  // mirroring the real sheet's own pattern of empty afternoon shifts. ---
  {
    signupKey: "board_tent",
    slotKey: "board_715_8",
    userKey: "laura_kim",
    teamKey: "sharks",
    status: "completed",
  },
  {
    signupKey: "board_tent",
    slotKey: "board_715_8",
    userKey: "angela_kim",
    teamKey: "comets",
    status: "completed",
  },
  {
    signupKey: "board_tent",
    slotKey: "board_8_9",
    userKey: "robert_nguyen",
    teamKey: "thunder",
    status: "completed",
  },
  {
    signupKey: "board_tent",
    slotKey: "board_8_9",
    userKey: "michelle_osei",
    teamKey: "lightning",
    status: "completed",
  },
  {
    signupKey: "board_tent",
    slotKey: "board_9_10",
    userKey: "david_torres",
    teamKey: "eagles",
    status: "completed",
  },
  {
    signupKey: "board_tent",
    slotKey: "board_9_10",
    userKey: "fatima_hassan",
    teamKey: "wildcats",
    status: "completed",
  },
  // Only 1 of 2 seats claimed.
  {
    signupKey: "board_tent",
    slotKey: "board_10_11",
    userKey: "kevin_obrien",
    teamKey: "eagles",
    status: "completed",
  },
  // Locked in but admin hasn't confirmed completion/points yet — a real "still needs review" state.
  {
    signupKey: "board_tent",
    slotKey: "board_11_12",
    userKey: "demo_head_coach",
    teamKey: "sharks",
    status: "assigned",
  },
  // 12-1 through 3-4 deliberately empty — understaffed afternoon, matching the real sheet.

  // --- ref_tent (DIRECT_CLAIM, still open) — early claims only, `pending` since
  // nothing is finalized on an open signup; afternoon left open for a demo
  // visitor to claim live. ---
  {
    signupKey: "ref_tent",
    slotKey: "ref_8_9",
    userKey: "tom_baker",
    teamKey: "lightning",
    status: "pending",
  },
  {
    signupKey: "ref_tent",
    slotKey: "ref_9_10",
    userKey: "nina_alvarez",
    teamKey: "wildcats",
    status: "pending",
  },
  {
    signupKey: "ref_tent",
    slotKey: "ref_10_11",
    userKey: "demo_referee",
    teamKey: "thunder",
    status: "pending",
  },
  {
    signupKey: "ref_tent",
    slotKey: "ref_11_12",
    userKey: "grace_lin",
    teamKey: "wildcats",
    status: "pending",
  },
  {
    signupKey: "ref_tent",
    slotKey: "ref_11_12",
    userKey: "demo_coach",
    teamKey: "comets",
    status: "pending",
  },
  // 12-1 through 3-4 left completely unclaimed — obvious, uncontested slots for a live demo visitor.
]
