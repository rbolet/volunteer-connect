import { describe, expect, it } from "vitest"
import { demoEvents, demoSignups, demoSlotResponses, demoTeams, demoUsers } from "../demo-data"
import { deriveSignupWindow } from "../generate"

// Content-integrity tests: the seed generator resolves demo-data's string
// `key` cross-references into FKs at runtime — these tests make a broken
// reference (or a content edit that violates a DB constraint) fail in unit
// tests instead of mid-transaction against the live DB.

const teamKeys = new Set(demoTeams.map((t) => t.key))
const userKeys = new Set(demoUsers.map((u) => u.key))
const eventKeys = new Set(demoEvents.map((e) => e.key))
const signupsByKey = new Map(demoSignups.map((s) => [s.key, s]))

describe("demo-data cross-references", () => {
  it("has unique keys per collection", () => {
    expect(teamKeys.size).toBe(demoTeams.length)
    expect(userKeys.size).toBe(demoUsers.length)
    expect(eventKeys.size).toBe(demoEvents.length)
    expect(signupsByKey.size).toBe(demoSignups.length)
    for (const s of demoSignups) {
      expect(new Set(s.slots.map((sl) => sl.key)).size).toBe(s.slots.length)
    }
  })

  it("every membership references an existing team", () => {
    for (const u of demoUsers) {
      for (const m of u.memberships) {
        expect(teamKeys, `${u.key} → ${m.teamKey}`).toContain(m.teamKey)
      }
    }
  })

  it("every signup's eventKey references an existing event", () => {
    for (const s of demoSignups) {
      if (s.eventKey) expect(eventKeys).toContain(s.eventKey)
    }
  })

  it("every slot response resolves to a real signup, slot, user, and team", () => {
    for (const r of demoSlotResponses) {
      const signup = signupsByKey.get(r.signupKey)
      expect(signup, `signup ${r.signupKey}`).toBeDefined()
      expect(
        signup!.slots.some((sl) => sl.key === r.slotKey),
        `slot ${r.signupKey}/${r.slotKey}`
      ).toBe(true)
      expect(userKeys, `user ${r.userKey}`).toContain(r.userKey)
      expect(teamKeys, `team ${r.teamKey}`).toContain(r.teamKey)
    }
  })
})

describe("demo-data DB-constraint invariants", () => {
  it("never has two responses from the same user on the same slot (unique user_id+slot_id)", () => {
    const seen = new Set<string>()
    for (const r of demoSlotResponses) {
      const pair = `${r.userKey}|${r.signupKey}/${r.slotKey}`
      expect(seen.has(pair), pair).toBe(false)
      seen.add(pair)
    }
  })

  it("never plans more responses on a slot than its capacity", () => {
    const counts = new Map<string, number>()
    for (const r of demoSlotResponses) {
      const ref = `${r.signupKey}/${r.slotKey}`
      counts.set(ref, (counts.get(ref) ?? 0) + 1)
    }
    for (const [ref, count] of counts) {
      const [signupKey, slotKey] = ref.split("/")
      const slot = signupsByKey.get(signupKey)!.slots.find((sl) => sl.key === slotKey)!
      expect(count, ref).toBeLessThanOrEqual(slot.capacity)
    }
  })

  it("responders belong to the team they assign points to", () => {
    const usersByKey = new Map(demoUsers.map((u) => [u.key, u]))
    for (const r of demoSlotResponses) {
      const user = usersByKey.get(r.userKey)!
      expect(
        user.memberships.some((m) => m.teamKey === r.teamKey),
        `${r.userKey} → ${r.teamKey}`
      ).toBe(true)
    }
  })

  it("responders hold a role eligible for the signup", () => {
    const usersByKey = new Map(demoUsers.map((u) => [u.key, u]))
    for (const r of demoSlotResponses) {
      const signup = signupsByKey.get(r.signupKey)!
      const user = usersByKey.get(r.userKey)!
      expect(
        user.memberships.some((m) => signup.eligibleRoles.includes(m.role)),
        `${r.userKey} on ${r.signupKey}`
      ).toBe(true)
    }
  })

  it("response statuses fit their signup's lifecycle stage", () => {
    for (const r of demoSlotResponses) {
      const signup = signupsByKey.get(r.signupKey)!
      if (signup.status === "open") {
        // Nothing is assigned/completed while a signup is still open.
        expect(r.status, `${r.userKey} on ${r.signupKey}`).toBe("pending")
      }
      if (r.status === "completed") {
        expect(signup.status, `completed response on ${r.signupKey}`).toBe("finalized")
      }
    }
  })
})

describe("deriveSignupWindow", () => {
  const now = new Date("2026-07-15T12:00:00.000Z")

  it("open signups opened in the past and close in the future", () => {
    const w = deriveSignupWindow("open", now)
    expect(w.opens_at.getTime()).toBeLessThan(now.getTime())
    expect(w.closes_at.getTime()).toBeGreaterThan(now.getTime())
  })

  it("finalized signups have a fully past window", () => {
    const w = deriveSignupWindow("finalized", now)
    expect(w.opens_at.getTime()).toBeLessThan(w.closes_at.getTime())
    expect(w.closes_at.getTime()).toBeLessThan(now.getTime())
  })
})
