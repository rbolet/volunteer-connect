import { describe, expect, it } from "vitest"
import type { SignupStatus } from "@vc/types"
import { evaluateSlotEdit, evaluateStatusChange } from "../lib/status-rules"

describe("evaluateStatusChange", () => {
  const allowed: [SignupStatus, SignupStatus][] = [
    ["draft", "open"],
    ["open", "closed"],
    ["closed", "open"],
    ["closed", "finalized"],
  ]
  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(evaluateStatusChange(from, to)).toBe("ok")
  })

  const rejected: [SignupStatus, SignupStatus][] = [
    ["draft", "closed"],
    ["draft", "finalized"],
    ["open", "finalized"], // must pass through closed
    ["open", "draft"],
    ["closed", "draft"],
    ["finalized", "closed"], // terminal — no un-finalize
    ["finalized", "open"],
    ["open", "open"], // no-op transitions are rejected too
  ]
  it.each(rejected)("rejects %s → %s", (from, to) => {
    expect(evaluateStatusChange(from, to)).toBe("invalid_transition")
  })
})

describe("evaluateSlotEdit", () => {
  it("allows any edit while draft", () => {
    for (const action of ["add", "update", "delete"] as const) {
      expect(evaluateSlotEdit({ signupStatus: "draft", claimedCount: 0, action })).toBe("ok")
    }
  })

  it("rejects all edits once closed or finalized", () => {
    for (const signupStatus of ["closed", "finalized"] as const) {
      expect(evaluateSlotEdit({ signupStatus, claimedCount: 0, action: "update" })).toBe(
        "signup_not_editable"
      )
    }
  })

  it("allows adding a slot while open", () => {
    expect(evaluateSlotEdit({ signupStatus: "open", claimedCount: 0, action: "add" })).toBe("ok")
  })

  it("rejects deleting a claimed slot while open", () => {
    expect(evaluateSlotEdit({ signupStatus: "open", claimedCount: 1, action: "delete" })).toBe(
      "slot_has_claims"
    )
  })

  it("allows deleting an unclaimed slot while open", () => {
    expect(evaluateSlotEdit({ signupStatus: "open", claimedCount: 0, action: "delete" })).toBe("ok")
  })

  it("rejects shrinking capacity below claimed seats", () => {
    expect(
      evaluateSlotEdit({ signupStatus: "open", claimedCount: 2, action: "update", newCapacity: 1 })
    ).toBe("capacity_below_claims")
  })

  it("allows capacity equal to claimed seats", () => {
    expect(
      evaluateSlotEdit({ signupStatus: "open", claimedCount: 2, action: "update", newCapacity: 2 })
    ).toBe("ok")
  })
})
