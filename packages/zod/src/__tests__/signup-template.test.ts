import { describe, expect, it } from "vitest"
import { createSignupTemplateSchema, saveSignupAsTemplateSchema } from "../signup-template"

const validCreate = {
  title: "Saturday Tent Duty",
  description: "Standard tent shift template.",
  eligibleRoles: ["volunteer", "coach"],
  slots: [
    { label: "Tent 8:00–10:00 AM", pointValue: 2, capacity: 2 },
    { label: "Tent 10:00–12:00 PM", pointValue: 1, capacity: 1 },
  ],
}

describe("createSignupTemplateSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = createSignupTemplateSchema.parse(validCreate)
    expect(parsed.slots).toHaveLength(2)
  })

  it("applies slot defaults (pointValue 0, capacity 1)", () => {
    const parsed = createSignupTemplateSchema.parse({
      ...validCreate,
      slots: [{ label: "Just a label" }],
    })
    expect(parsed.slots[0]).toEqual({ label: "Just a label", pointValue: 0, capacity: 1 })
  })

  it("requires at least one slot", () => {
    expect(createSignupTemplateSchema.safeParse({ ...validCreate, slots: [] }).success).toBe(false)
  })

  it("requires at least one eligible role", () => {
    expect(
      createSignupTemplateSchema.safeParse({ ...validCreate, eligibleRoles: [] }).success
    ).toBe(false)
  })

  it("requires a non-empty title", () => {
    expect(createSignupTemplateSchema.safeParse({ ...validCreate, title: "" }).success).toBe(false)
  })

  it("rejects invalid slot values", () => {
    const bad = { ...validCreate, slots: [{ label: "x", pointValue: -1, capacity: 0 }] }
    expect(createSignupTemplateSchema.safeParse(bad).success).toBe(false)
  })
})

describe("saveSignupAsTemplateSchema", () => {
  it("accepts just a title", () => {
    expect(saveSignupAsTemplateSchema.parse({ title: "My Template" })).toEqual({
      title: "My Template",
    })
  })

  it("requires a non-empty title", () => {
    expect(saveSignupAsTemplateSchema.safeParse({ title: "" }).success).toBe(false)
  })

  it("strips caller-supplied slots/eligibleRoles — the source signup drives those server-side", () => {
    const parsed = saveSignupAsTemplateSchema.parse({
      title: "My Template",
      slots: validCreate.slots,
      eligibleRoles: validCreate.eligibleRoles,
    })
    expect(parsed).not.toHaveProperty("slots")
    expect(parsed).not.toHaveProperty("eligibleRoles")
  })
})
