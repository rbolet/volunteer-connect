import { describe, expect, it } from "vitest"
import { demoIdentitySchema, demoSessionResponseSchema, resolvedSessionSchema } from "../session"

const validSession = {
  user_id: "user_1",
  org_id: "org_1",
  org_roles: [],
  team_roles: [{ team_id: "team_1", role: "volunteer" }],
  source: "demo",
}

describe("resolvedSessionSchema", () => {
  it("accepts a valid demo session", () => {
    expect(resolvedSessionSchema.parse(validSession)).toEqual(validSession)
  })

  it("accepts an admin session with no team roles", () => {
    const admin = { ...validSession, org_roles: ["admin"], team_roles: [], source: "supabase" }
    expect(resolvedSessionSchema.parse(admin)).toEqual(admin)
  })

  it("rejects an unknown source", () => {
    expect(resolvedSessionSchema.safeParse({ ...validSession, source: "magic" }).success).toBe(
      false
    )
  })

  it("rejects an unknown org role", () => {
    expect(resolvedSessionSchema.safeParse({ ...validSession, org_roles: ["owner"] }).success).toBe(
      false
    )
  })

  it("rejects a team role outside the enum", () => {
    const bad = { ...validSession, team_roles: [{ team_id: "t", role: "goalie" }] }
    expect(resolvedSessionSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects empty user_id/org_id", () => {
    expect(resolvedSessionSchema.safeParse({ ...validSession, user_id: "" }).success).toBe(false)
    expect(resolvedSessionSchema.safeParse({ ...validSession, org_id: "" }).success).toBe(false)
  })
})

describe("demoIdentitySchema", () => {
  it("accepts admin plus every team role", () => {
    for (const identity of ["admin", "head_coach", "coach", "referee", "volunteer"]) {
      expect(demoIdentitySchema.parse(identity)).toBe(identity)
    }
  })

  it("rejects arbitrary identities", () => {
    expect(demoIdentitySchema.safeParse("superuser").success).toBe(false)
  })
})

describe("demoSessionResponseSchema", () => {
  it("accepts a full demo-session payload", () => {
    const payload = {
      identity: "volunteer",
      user: { id: "user_1", name: "Sam Rodriguez", email: "sam.rodriguez@example.com" },
      session: validSession,
    }
    expect(demoSessionResponseSchema.parse(payload)).toEqual(payload)
  })

  it("rejects a payload with an invalid nested session", () => {
    const payload = {
      identity: "volunteer",
      user: { id: "user_1", name: "Sam Rodriguez", email: "sam.rodriguez@example.com" },
      session: { ...validSession, source: "other" },
    }
    expect(demoSessionResponseSchema.safeParse(payload).success).toBe(false)
  })
})
