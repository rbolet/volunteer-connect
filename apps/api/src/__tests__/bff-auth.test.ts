import { describe, expect, it } from "vitest"
import request from "supertest"
import { BFF_SECRET_HEADER, SESSION_HEADER } from "../middleware/bff-auth"
import { authHeaders, testApp, TEST_SECRET, volunteerSession } from "./helpers"

describe("BFF auth guard", () => {
  it("leaves /health unauthenticated", async () => {
    await request(testApp()).get("/health").expect(200)
  })

  it("rejects business routes without the BFF secret", async () => {
    const res = await request(testApp()).get("/signups").expect(401)
    expect(res.body.error).toBe("unauthorized")
  })

  it("rejects a wrong secret", async () => {
    await request(testApp()).get("/signups").set(BFF_SECRET_HEADER, "wrong-secret").expect(401)
  })

  it("rejects a valid secret with no session header", async () => {
    const res = await request(testApp())
      .get("/signups")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .expect(401)
    expect(res.body.error).toBe("missing_session")
  })

  it("rejects malformed session JSON", async () => {
    const res = await request(testApp())
      .get("/signups")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .set(SESSION_HEADER, "{not json")
      .expect(401)
    expect(res.body.error).toBe("invalid_session")
  })

  it("rejects a session payload failing schema validation", async () => {
    await request(testApp())
      .get("/signups")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .set(SESSION_HEADER, JSON.stringify({ user_id: "u" }))
      .expect(401)
  })

  it("accepts a valid secret + session", async () => {
    const app = testApp({ signups: { listForOrg: async () => [] } })
    const res = await request(app).get("/signups").set(authHeaders(volunteerSession)).expect(200)
    expect(res.body.signups).toEqual([])
  })

  it("fails closed (500) when the server has no secret configured", async () => {
    const app = testApp()
    delete process.env.TRUSTED_BFF_SECRET
    const res = await request(app).get("/signups").set(authHeaders()).expect(500)
    expect(res.body.error).toBe("server_misconfigured")
  })
})
