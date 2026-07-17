import type { Prisma, PrismaClient } from "@prisma/client"
import type { SignupStatus } from "@vc/types"
import {
  demoEvents,
  demoOrganization,
  demoSeason,
  demoSignups,
  demoSlotResponses,
  demoTeams,
  demoUsers,
  eventSaturday,
} from "./demo-data"

type Tx = Prisma.TransactionClient

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Signup open/close windows aren't part of the curated content — the content's
 * `status` field is authoritative, and windows are derived at seed time so the
 * two always read consistently no matter when the seed (or a future nightly
 * reset) runs:
 * - finalized: opened ~3 weeks ago, closed 2 days ago ("recently wrapped up")
 * - open:      opened a week ago, closes the day before the (always-future,
 *              evergreen-October) event Saturday
 * - draft/closed: same window shape as finalized, kept for completeness.
 */
export function deriveSignupWindow(
  status: SignupStatus,
  now: Date = new Date()
): { opens_at: Date; closes_at: Date } {
  if (status === "open") {
    return {
      opens_at: new Date(now.getTime() - 7 * DAY_MS),
      closes_at: new Date(eventSaturday.getTime() - 1 * DAY_MS),
    }
  }
  return {
    opens_at: new Date(now.getTime() - 21 * DAY_MS),
    closes_at: new Date(now.getTime() - 2 * DAY_MS),
  }
}

export interface SeedSummary {
  orgId: string
  organizations: number
  users: number
  orgRoles: number
  seasons: number
  teams: number
  teamMemberships: number
  events: number
  signups: number
  signupSlots: number
  slotResponses: number
  pointsLedger: number
}

/**
 * Turns the curated demo content (demo-data.ts) into real rows, resolving the
 * content's string `key` cross-references into actual foreign keys. Runs
 * against a transaction client so the whole org appears atomically.
 *
 * Per demo-data.ts's documented convention, one PointsLedger row is derived
 * automatically for every `completed` response (points = the slot's
 * pointValue, awarded by the demo admin) — completed-ness and awarded points
 * are never allowed to drift apart in the content.
 */
export async function generateDemoOrg(tx: Tx): Promise<SeedSummary> {
  const org = await tx.organization.create({
    data: { name: demoOrganization.name, is_demo: demoOrganization.isDemo },
  })

  // Admin first so every subsequent row can carry created_by = admin.
  const adminContent = demoUsers.find((u) => u.orgRole === "admin")
  if (!adminContent) throw new Error("demo-data must define exactly one org-admin user")

  const userIdByKey = new Map<string, string>()
  const admin = await tx.user.create({
    data: {
      org_id: org.id,
      auth_id: adminContent.authId,
      email: adminContent.email,
      name: adminContent.name,
    },
  })
  userIdByKey.set(adminContent.key, admin.id)

  for (const u of demoUsers) {
    if (u.key === adminContent.key) continue
    const created = await tx.user.create({
      data: {
        org_id: org.id,
        auth_id: u.authId,
        email: u.email,
        name: u.name,
        created_by: admin.id,
        updated_by: admin.id,
      },
    })
    userIdByKey.set(u.key, created.id)
  }

  let orgRoles = 0
  for (const u of demoUsers) {
    if (!u.orgRole) continue
    await tx.orgRole.create({
      data: { user_id: mustGet(userIdByKey, u.key), org_id: org.id, role: u.orgRole },
    })
    orgRoles++
  }

  const season = await tx.season.create({
    data: {
      org_id: org.id,
      name: demoSeason.name,
      is_active: demoSeason.isActive,
      created_by: admin.id,
      updated_by: admin.id,
    },
  })

  const teamIdByKey = new Map<string, string>()
  for (const t of demoTeams) {
    const created = await tx.team.create({
      data: {
        org_id: org.id,
        season_id: season.id,
        name: t.name,
        team_number: t.teamNumber ?? null,
        color: t.color ?? null,
        created_by: admin.id,
        updated_by: admin.id,
      },
    })
    teamIdByKey.set(t.key, created.id)
  }

  let teamMemberships = 0
  for (const u of demoUsers) {
    for (const m of u.memberships) {
      await tx.teamMembership.create({
        data: {
          user_id: mustGet(userIdByKey, u.key),
          team_id: mustGet(teamIdByKey, m.teamKey),
          role: m.role,
        },
      })
      teamMemberships++
    }
  }

  const eventIdByKey = new Map<string, string>()
  for (const e of demoEvents) {
    const created = await tx.event.create({
      data: {
        org_id: org.id,
        season_id: season.id,
        name: e.name,
        event_date: e.eventDate,
        created_by: admin.id,
        updated_by: admin.id,
      },
    })
    eventIdByKey.set(e.key, created.id)
  }

  const slotIdByKey = new Map<string, string>() // "signupKey/slotKey" → id
  const slotPointsByKey = new Map<string, number>()
  let signupSlots = 0
  for (const s of demoSignups) {
    const window = deriveSignupWindow(s.status)
    const signup = await tx.signup.create({
      data: {
        org_id: org.id,
        season_id: season.id,
        event_id: s.eventKey ? mustGet(eventIdByKey, s.eventKey) : null,
        title: s.title,
        description: s.description ?? null,
        mode: s.mode,
        status: s.status,
        opens_at: window.opens_at,
        closes_at: window.closes_at,
        created_by: admin.id,
        updated_by: admin.id,
        eligibleRoles: { create: s.eligibleRoles.map((role) => ({ role })) },
      },
    })
    for (const slot of s.slots) {
      const created = await tx.signupSlot.create({
        data: {
          signup_id: signup.id,
          label: slot.label,
          point_value: slot.pointValue,
          capacity: slot.capacity,
          created_by: admin.id,
          updated_by: admin.id,
        },
      })
      slotIdByKey.set(`${s.key}/${slot.key}`, created.id)
      slotPointsByKey.set(`${s.key}/${slot.key}`, slot.pointValue)
      signupSlots++
    }
  }

  let pointsLedger = 0
  for (const r of demoSlotResponses) {
    const slotRef = `${r.signupKey}/${r.slotKey}`
    const userId = mustGet(userIdByKey, r.userKey)
    const response = await tx.slotResponse.create({
      data: {
        slot_id: mustGet(slotIdByKey, slotRef),
        user_id: userId,
        team_id: mustGet(teamIdByKey, r.teamKey),
        rank: r.rank ?? null,
        status: r.status,
        created_by: userId,
        updated_by: userId,
      },
    })
    if (r.status === "completed") {
      await tx.pointsLedger.create({
        data: {
          team_id: mustGet(teamIdByKey, r.teamKey),
          slot_response_id: response.id,
          points: mustGet(slotPointsByKey, slotRef),
          awarded_by: admin.id,
          created_by: admin.id,
          updated_by: admin.id,
        },
      })
      pointsLedger++
    }
  }

  return {
    orgId: org.id,
    organizations: 1,
    users: demoUsers.length,
    orgRoles,
    seasons: 1,
    teams: demoTeams.length,
    teamMemberships,
    events: demoEvents.length,
    signups: demoSignups.length,
    signupSlots,
    slotResponses: demoSlotResponses.length,
    pointsLedger,
  }
}

/** Seeds the demo org atomically. Generous timeout — many sequential inserts over a pooled connection. */
export function seedDemoOrg(prisma: PrismaClient): Promise<SeedSummary> {
  return prisma.$transaction((tx) => generateDemoOrg(tx), {
    maxWait: 30_000,
    timeout: 120_000,
  })
}

function mustGet<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key)
  if (value === undefined) {
    throw new Error(`demo-data cross-reference "${String(key)}" does not resolve`)
  }
  return value
}
