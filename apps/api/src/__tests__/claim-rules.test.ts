import { describe, expect, it } from "vitest"
import type { ResolvedSession } from "@vc/types"
import { evaluateClaim, evaluateWithdraw, type ClaimContext } from "../lib/claim-rules"

const volunteer: ResolvedSession = {
  user_id: "user_vol",
  org_id: "org_demo",
  org_roles: [],
  team_roles: [{ team_id: "team_eagles", role: "volunteer" }],
  source: "demo",
}

function claimCtx(overrides: Partial<ClaimContext> = {}): ClaimContext {
  return {
    slot: {
      capacity: 2,
      claimedCount: 0,
      signup: {
        status: "open",
        mode: "DIRECT_CLAIM",
        eligibleRoles: ["volunteer", "coach", "head_coach", "referee"],
      },
    },
    session: volunteer,
    teamId: "team_eagles",
    alreadyClaimed: false,
    ...overrides,
  }
}

describe("evaluateClaim", () => {
  it("accepts an eligible volunteer claiming a free seat for their own team", () => {
    expect(evaluateClaim(claimCtx())).toBe("ok")
  })

  it("rejects a missing slot", () => {
    expect(evaluateClaim(claimCtx({ slot: null }))).toBe("slot_not_found")
  })

  it("rejects RANKED_CHOICE signups (direct claim only)", () => {
    const ctx = claimCtx()
    ctx.slot!.signup.mode = "RANKED_CHOICE"
    expect(evaluateClaim(ctx)).toBe("wrong_mode")
  })

  it("rejects every non-open lifecycle status", () => {
    for (const status of ["draft", "closed", "finalized"] as const) {
      const ctx = claimCtx()
      ctx.slot!.signup.status = status
      expect(evaluateClaim(ctx), status).toBe("signup_not_open")
    }
  })

  it("rejects users holding no eligible role", () => {
    const ctx = claimCtx()
    ctx.slot!.signup.eligibleRoles = ["referee"]
    expect(evaluateClaim(ctx)).toBe("not_eligible")
  })

  it("rejects assigning points to a team the user doesn't belong to", () => {
    expect(evaluateClaim(claimCtx({ teamId: "team_sharks" }))).toBe("not_your_team")
  })

  it("rejects a duplicate claim before reporting fullness", () => {
    const ctx = claimCtx({ alreadyClaimed: true })
    ctx.slot!.claimedCount = 2
    expect(evaluateClaim(ctx)).toBe("already_claimed")
  })

  it("rejects a full slot", () => {
    const ctx = claimCtx()
    ctx.slot!.claimedCount = 2
    expect(evaluateClaim(ctx)).toBe("slot_full")
  })

  it("accepts the last remaining seat", () => {
    const ctx = claimCtx()
    ctx.slot!.claimedCount = 1
    expect(evaluateClaim(ctx)).toBe("ok")
  })
})

describe("evaluateWithdraw", () => {
  const own = { userId: "user_vol", status: "pending" as const, signupStatus: "open" as const }

  it("accepts withdrawing an own pending response on an open signup", () => {
    expect(evaluateWithdraw({ response: own, session: volunteer })).toBe("ok")
  })

  it("rejects a missing response", () => {
    expect(evaluateWithdraw({ response: null, session: volunteer })).toBe("not_found")
  })

  it("rejects someone else's response", () => {
    const response = { ...own, userId: "user_other" }
    expect(evaluateWithdraw({ response, session: volunteer })).toBe("not_owner")
  })

  it("rejects once the signup is no longer open", () => {
    for (const signupStatus of ["draft", "closed", "finalized"] as const) {
      const response = { ...own, signupStatus }
      expect(evaluateWithdraw({ response, session: volunteer }), signupStatus).toBe(
        "signup_not_open"
      )
    }
  })

  it("rejects non-pending responses", () => {
    for (const status of ["assigned", "declined", "completed"] as const) {
      const response = { ...own, status }
      expect(evaluateWithdraw({ response, session: volunteer }), status).toBe("not_pending")
    }
  })
})
