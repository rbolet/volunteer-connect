import { describe, expect, it } from "vitest"
import { inviteRedeemInputSchema, inviteValidateResponseSchema } from "../org-invite"

const validRedeem = {
  token: "7K4M9XQP",
  authId: "auth_1",
  email: "new.user@example.com",
  name: "New User",
}

describe("inviteRedeemInputSchema", () => {
  it("accepts a valid redemption input", () => {
    expect(inviteRedeemInputSchema.parse(validRedeem)).toEqual(validRedeem)
  })

  it("rejects an empty token", () => {
    expect(inviteRedeemInputSchema.safeParse({ ...validRedeem, token: "" }).success).toBe(false)
  })

  it("rejects an empty authId", () => {
    expect(inviteRedeemInputSchema.safeParse({ ...validRedeem, authId: "" }).success).toBe(false)
  })

  it("rejects an invalid email", () => {
    expect(
      inviteRedeemInputSchema.safeParse({ ...validRedeem, email: "not-an-email" }).success
    ).toBe(false)
  })

  it("rejects an empty name", () => {
    expect(inviteRedeemInputSchema.safeParse({ ...validRedeem, name: "" }).success).toBe(false)
  })
})

describe("inviteValidateResponseSchema", () => {
  it("accepts a valid response", () => {
    const payload = { org_id: "org_1", org_name: "Test AYSO" }
    expect(inviteValidateResponseSchema.parse(payload)).toEqual(payload)
  })

  it("rejects a missing org_name", () => {
    expect(inviteValidateResponseSchema.safeParse({ org_id: "org_1" }).success).toBe(false)
  })
})
