import { describe, expect, it, vi } from "vitest"
import request from "supertest"
import { adminSession, authHeaders, testApp, volunteerSession } from "./helpers"

const createBody = {
  title: "Snack Shack — Saturday",
  description: null,
  eligibleRoles: ["volunteer"],
  slots: [{ label: "Snack Shack 8:00–10:00 AM", pointValue: 2, capacity: 2 }],
}

describe("admin gate", () => {
  const cases: [string, (app: ReturnType<typeof testApp>) => request.Test][] = [
    ["POST /signups", (app) => request(app).post("/signups").send(createBody)],
    [
      "PATCH /signups/:id/status",
      (app) => request(app).patch("/signups/s1/status").send({ status: "open" }),
    ],
    [
      "POST /signups/:id/slots",
      (app) => request(app).post("/signups/s1/slots").send(createBody.slots[0]),
    ],
    ["PATCH /slots/:id", (app) => request(app).patch("/slots/sl1").send(createBody.slots[0])],
    ["DELETE /slots/:id", (app) => request(app).delete("/slots/sl1")],
  ]

  it.each(cases)("%s returns 403 for a non-admin session", async (_name, call) => {
    const res = await call(testApp()).set(authHeaders(volunteerSession))
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("admin_only")
  })
})

describe("POST /signups", () => {
  it("400s on an invalid body (no slots)", async () => {
    const app = testApp()
    await request(app)
      .post("/signups")
      .set(authHeaders(adminSession))
      .send({ ...createBody, slots: [] })
      .expect(400)
  })

  it("creates and returns the new id", async () => {
    const create = vi.fn().mockResolvedValue({ ok: true, id: "signup_new" })
    const app = testApp({ signups: { create } })
    const res = await request(app)
      .post("/signups")
      .set(authHeaders(adminSession))
      .send(createBody)
      .expect(201)
    expect(res.body.id).toBe("signup_new")
    expect(create).toHaveBeenCalledWith({
      orgId: adminSession.org_id,
      adminId: adminSession.user_id,
      input: createBody,
    })
  })

  it("409s when no active season exists", async () => {
    const app = testApp({
      signups: { create: async () => ({ ok: false, reason: "no_active_season" }) },
    })
    const res = await request(app)
      .post("/signups")
      .set(authHeaders(adminSession))
      .send(createBody)
      .expect(409)
    expect(res.body.error).toBe("no_active_season")
  })
})

describe("PATCH /signups/:id/status", () => {
  it("400s on draft or unknown targets", async () => {
    const app = testApp()
    await request(app)
      .patch("/signups/s1/status")
      .set(authHeaders(adminSession))
      .send({ status: "draft" })
      .expect(400)
    await request(app)
      .patch("/signups/s1/status")
      .set(authHeaders(adminSession))
      .send({ status: "archived" })
      .expect(400)
  })

  it("passes the transition to the repo and 200s", async () => {
    const changeStatus = vi.fn().mockResolvedValue({ ok: true })
    const app = testApp({ signups: { changeStatus } })
    await request(app)
      .patch("/signups/s1/status")
      .set(authHeaders(adminSession))
      .send({ status: "finalized" })
      .expect(200)
    expect(changeStatus).toHaveBeenCalledWith({
      session: adminSession,
      signupId: "s1",
      target: "finalized",
    })
  })

  it("maps not_found to 404 and invalid_transition to 409", async () => {
    const notFound = testApp({
      signups: { changeStatus: async () => ({ ok: false, reason: "not_found" }) },
    })
    await request(notFound)
      .patch("/signups/s1/status")
      .set(authHeaders(adminSession))
      .send({ status: "open" })
      .expect(404)

    const invalid = testApp({
      signups: { changeStatus: async () => ({ ok: false, reason: "invalid_transition" }) },
    })
    const res = await request(invalid)
      .patch("/signups/s1/status")
      .set(authHeaders(adminSession))
      .send({ status: "open" })
      .expect(409)
    expect(res.body.error).toBe("invalid_transition")
  })
})

describe("slot mutations", () => {
  it("POST /signups/:id/slots creates with defaults applied", async () => {
    const add = vi.fn().mockResolvedValue({ ok: true, id: "slot_new" })
    const app = testApp({ slots: { add } })
    const res = await request(app)
      .post("/signups/s1/slots")
      .set(authHeaders(adminSession))
      .send({ label: "Extra shift" })
      .expect(201)
    expect(res.body.id).toBe("slot_new")
    expect(add).toHaveBeenCalledWith({
      session: adminSession,
      signupId: "s1",
      input: { label: "Extra shift", pointValue: 0, capacity: 1 },
    })
  })

  it("PATCH /slots/:id maps guard rejections to 409", async () => {
    for (const reason of ["signup_not_editable", "capacity_below_claims"] as const) {
      const app = testApp({ slots: { update: async () => ({ ok: false, reason }) } })
      const res = await request(app)
        .patch("/slots/sl1")
        .set(authHeaders(adminSession))
        .send({ label: "x", pointValue: 1, capacity: 1 })
        .expect(409)
      expect(res.body.error).toBe(reason)
    }
  })

  it("DELETE /slots/:id 204s on success and 409s on slot_has_claims", async () => {
    const remove = vi.fn().mockResolvedValue({ ok: true })
    await request(testApp({ slots: { remove } }))
      .delete("/slots/sl1")
      .set(authHeaders(adminSession))
      .expect(204)
    expect(remove).toHaveBeenCalledWith({ session: adminSession, slotId: "sl1" })

    const blocked = testApp({
      slots: { remove: async () => ({ ok: false, reason: "slot_has_claims" }) },
    })
    const res = await request(blocked)
      .delete("/slots/sl1")
      .set(authHeaders(adminSession))
      .expect(409)
    expect(res.body.error).toBe("slot_has_claims")
  })
})
