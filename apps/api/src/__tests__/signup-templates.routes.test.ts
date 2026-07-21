import { describe, expect, it, vi } from "vitest"
import request from "supertest"
import { adminSession, authHeaders, testApp, volunteerSession } from "./helpers"

const createBody = {
  title: "Saturday Tent Duty",
  description: "Standard tent shift template.",
  eligibleRoles: ["volunteer"],
  slots: [{ label: "Tent 8:00–10:00 AM", pointValue: 2, capacity: 2 }],
}

describe("admin gate", () => {
  const cases: [string, (app: ReturnType<typeof testApp>) => request.Test][] = [
    ["GET /signup-templates", (app) => request(app).get("/signup-templates")],
    ["POST /signup-templates", (app) => request(app).post("/signup-templates").send(createBody)],
    ["DELETE /signup-templates/:id", (app) => request(app).delete("/signup-templates/t1")],
    [
      "POST /signups/:id/save-as-template",
      (app) => request(app).post("/signups/s1/save-as-template").send({ title: "x" }),
    ],
  ]

  it.each(cases)("%s returns 403 for a non-admin session", async (_name, call) => {
    const res = await call(testApp()).set(authHeaders(volunteerSession))
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("admin_only")
  })
})

describe("GET /signup-templates", () => {
  it("lists templates for the org", async () => {
    const listForOrg = vi.fn().mockResolvedValue([
      {
        id: "t1",
        title: "Saturday Tent Duty",
        description: null,
        eligibleRoles: ["volunteer"],
        slots: [],
      },
    ])
    const app = testApp({ signupTemplates: { listForOrg } })
    const res = await request(app)
      .get("/signup-templates")
      .set(authHeaders(adminSession))
      .expect(200)
    expect(res.body.templates).toHaveLength(1)
    expect(listForOrg).toHaveBeenCalledWith(adminSession.org_id)
  })
})

describe("POST /signup-templates", () => {
  it("400s on an invalid body (no slots)", async () => {
    const app = testApp()
    await request(app)
      .post("/signup-templates")
      .set(authHeaders(adminSession))
      .send({ ...createBody, slots: [] })
      .expect(400)
  })

  it("creates and returns the new id", async () => {
    const create = vi.fn().mockResolvedValue({ ok: true, id: "template_new" })
    const app = testApp({ signupTemplates: { create } })
    const res = await request(app)
      .post("/signup-templates")
      .set(authHeaders(adminSession))
      .send(createBody)
      .expect(201)
    expect(res.body.id).toBe("template_new")
    expect(create).toHaveBeenCalledWith({
      orgId: adminSession.org_id,
      adminId: adminSession.user_id,
      input: createBody,
    })
  })
})

describe("DELETE /signup-templates/:id", () => {
  it("removes and returns ok", async () => {
    const remove = vi.fn().mockResolvedValue({ ok: true })
    const app = testApp({ signupTemplates: { remove } })
    await request(app).delete("/signup-templates/t1").set(authHeaders(adminSession)).expect(200)
    expect(remove).toHaveBeenCalledWith({ orgId: adminSession.org_id, templateId: "t1" })
  })

  it("404s on unknown template", async () => {
    const app = testApp({
      signupTemplates: { remove: async () => ({ ok: false, reason: "not_found" }) },
    })
    await request(app).delete("/signup-templates/nope").set(authHeaders(adminSession)).expect(404)
  })
})

describe("POST /signups/:id/save-as-template", () => {
  it("400s on an invalid body (empty title)", async () => {
    const app = testApp()
    await request(app)
      .post("/signups/s1/save-as-template")
      .set(authHeaders(adminSession))
      .send({ title: "" })
      .expect(400)
  })

  it("creates a template from the source signup and returns the new id", async () => {
    const createFromSignup = vi.fn().mockResolvedValue({ ok: true, id: "template_new" })
    const app = testApp({ signupTemplates: { createFromSignup } })
    const res = await request(app)
      .post("/signups/s1/save-as-template")
      .set(authHeaders(adminSession))
      .send({ title: "Saturday Tent Duty" })
      .expect(201)
    expect(res.body.id).toBe("template_new")
    expect(createFromSignup).toHaveBeenCalledWith({
      orgId: adminSession.org_id,
      adminId: adminSession.user_id,
      signupId: "s1",
      title: "Saturday Tent Duty",
    })
  })

  it("404s when the source signup doesn't exist", async () => {
    const app = testApp({
      signupTemplates: { createFromSignup: async () => ({ ok: false, reason: "not_found" }) },
    })
    await request(app)
      .post("/signups/nope/save-as-template")
      .set(authHeaders(adminSession))
      .send({ title: "x" })
      .expect(404)
  })
})
