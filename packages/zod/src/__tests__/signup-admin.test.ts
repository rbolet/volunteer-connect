import { describe, expect, it } from "vitest"
import { createSignupSchema, signupStatusChangeSchema } from "../signup"

const validCreate = {
  title: "Snack Shack — Saturday",
  description: "Run the snack shack during morning games.",
  eligibleRoles: ["volunteer", "coach"],
  slots: [
    { label: "Snack Shack 8:00–10:00 AM", pointValue: 2, capacity: 2 },
    { label: "Snack Shack 10:00–12:00 PM", pointValue: 1, capacity: 1 },
  ],
}

describe("createSignupSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = createSignupSchema.parse(validCreate)
    expect(parsed.slots).toHaveLength(2)
  })

  it("applies slot defaults (pointValue 0, capacity 1)", () => {
    const parsed = createSignupSchema.parse({
      ...validCreate,
      slots: [{ label: "Just a label" }],
    })
    expect(parsed.slots[0]).toEqual({ label: "Just a label", pointValue: 0, capacity: 1 })
  })

  it("requires at least one slot", () => {
    expect(createSignupSchema.safeParse({ ...validCreate, slots: [] }).success).toBe(false)
  })

  it("requires a non-empty title and at least one eligible role", () => {
    expect(createSignupSchema.safeParse({ ...validCreate, title: "" }).success).toBe(false)
    expect(createSignupSchema.safeParse({ ...validCreate, eligibleRoles: [] }).success).toBe(false)
  })

  it("rejects caller-supplied mode/status (unknown keys are stripped, not honored)", () => {
    const parsed = createSignupSchema.parse({
      ...validCreate,
      mode: "RANKED_CHOICE",
      status: "open",
    })
    expect(parsed).not.toHaveProperty("mode")
    expect(parsed).not.toHaveProperty("status")
  })

  it("rejects invalid slot values", () => {
    const bad = { ...validCreate, slots: [{ label: "x", pointValue: -1, capacity: 0 }] }
    expect(createSignupSchema.safeParse(bad).success).toBe(false)
  })
})

describe("signupStatusChangeSchema", () => {
  it("accepts open/closed/finalized", () => {
    for (const status of ["open", "closed", "finalized"]) {
      expect(signupStatusChangeSchema.parse({ status })).toEqual({ status })
    }
  })

  it("rejects draft and unknown statuses", () => {
    expect(signupStatusChangeSchema.safeParse({ status: "draft" }).success).toBe(false)
    expect(signupStatusChangeSchema.safeParse({ status: "archived" }).success).toBe(false)
  })
})
