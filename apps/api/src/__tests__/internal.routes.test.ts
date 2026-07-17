import { describe, expect, it } from "vitest"
import request from "supertest"
import type { DemoSessionResponse } from "@vc/types"
import { BFF_SECRET_HEADER } from "../middleware/bff-auth"
import { testApp, TEST_SECRET } from "./helpers"

const demoResponse: DemoSessionResponse = {
  identity: "volunteer",
  user: { id: "user_vol", name: "Sam Rodriguez", email: "sam.rodriguez@example.com" },
  session: {
    user_id: "user_vol",
    org_id: "org_demo",
    org_roles: [],
    team_roles: [{ team_id: "team_eagles", role: "volunteer" }],
    source: "demo",
  },
}

describe("GET /internal/demo-session", () => {
  it("requires the BFF secret (but no session)", async () => {
    await request(testApp()).get("/internal/demo-session?identity=volunteer").expect(401)
  })

  it("400s on an unknown identity", async () => {
    const app = testApp()
    const res = await request(app)
      .get("/internal/demo-session?identity=superuser")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .expect(400)
    expect(res.body.error).toBe("invalid_identity")
  })

  it("503s when the demo org isn't seeded", async () => {
    const app = testApp({ demoSession: { resolve: async () => null } })
    const res = await request(app)
      .get("/internal/demo-session?identity=volunteer")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .expect(503)
    expect(res.body.error).toBe("demo_not_seeded")
  })

  it("returns the resolved demo session", async () => {
    const app = testApp({ demoSession: { resolve: async () => demoResponse } })
    const res = await request(app)
      .get("/internal/demo-session?identity=volunteer")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .expect(200)
    expect(res.body).toEqual(demoResponse)
  })
})
