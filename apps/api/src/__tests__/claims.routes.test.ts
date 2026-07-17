import { describe, expect, it, vi } from "vitest"
import request from "supertest"
import type { ClaimRejection, WithdrawRejection } from "../lib/claim-rules"
import { authHeaders, testApp, volunteerSession } from "./helpers"

describe("POST /slots/:slotId/responses", () => {
  it("400s on a missing/invalid body", async () => {
    const app = testApp()
    await request(app).post("/slots/slot_1/responses").set(authHeaders()).send({}).expect(400)
    await request(app)
      .post("/slots/slot_1/responses")
      .set(authHeaders())
      .send({ teamId: "" })
      .expect(400)
  })

  it("201s with the new response id on success", async () => {
    const claim = vi.fn().mockResolvedValue({ ok: true, responseId: "resp_new" })
    const app = testApp({ slotResponses: { claim } })
    const res = await request(app)
      .post("/slots/slot_1/responses")
      .set(authHeaders())
      .send({ teamId: "team_eagles" })
      .expect(201)
    expect(res.body.id).toBe("resp_new")
    expect(claim).toHaveBeenCalledWith({
      session: volunteerSession,
      slotId: "slot_1",
      teamId: "team_eagles",
    })
  })

  const claimCases: [ClaimRejection, number][] = [
    ["slot_not_found", 404],
    ["wrong_mode", 409],
    ["signup_not_open", 409],
    ["not_eligible", 403],
    ["not_your_team", 403],
    ["already_claimed", 409],
    ["slot_full", 409],
  ]
  it.each(claimCases)("maps %s to %i", async (reason, status) => {
    const app = testApp({
      slotResponses: { claim: async () => ({ ok: false, reason }) },
    })
    const res = await request(app)
      .post("/slots/slot_1/responses")
      .set(authHeaders())
      .send({ teamId: "team_eagles" })
      .expect(status)
    expect(res.body.error).toBe(reason)
  })
})

describe("DELETE /slot-responses/:id", () => {
  it("204s on success", async () => {
    const withdraw = vi.fn().mockResolvedValue({ ok: true })
    const app = testApp({ slotResponses: { withdraw } })
    await request(app).delete("/slot-responses/resp_1").set(authHeaders()).expect(204)
    expect(withdraw).toHaveBeenCalledWith({ session: volunteerSession, responseId: "resp_1" })
  })

  const withdrawCases: [WithdrawRejection, number][] = [
    ["not_found", 404],
    ["not_owner", 404],
    ["signup_not_open", 409],
    ["not_pending", 409],
  ]
  it.each(withdrawCases)("maps %s to %i", async (reason, status) => {
    const app = testApp({
      slotResponses: { withdraw: async () => ({ ok: false, reason }) },
    })
    await request(app).delete("/slot-responses/resp_1").set(authHeaders()).expect(status)
  })
})

describe("GET /me/responses", () => {
  it("returns the session user's responses", async () => {
    const listForUser = vi.fn().mockResolvedValue([])
    const app = testApp({ slotResponses: { listForUser } })
    const res = await request(app).get("/me/responses").set(authHeaders()).expect(200)
    expect(res.body.responses).toEqual([])
    expect(listForUser).toHaveBeenCalledWith("org_demo", "user_vol")
  })
})

describe("error handling", () => {
  it("500s (not hangs) when a repo throws", async () => {
    const app = testApp({
      teams: {
        listWithPoints: async () => {
          throw new Error("boom")
        },
      },
    })
    const res = await request(app).get("/teams").set(authHeaders()).expect(500)
    expect(res.body.error).toBe("internal_error")
  })
})
