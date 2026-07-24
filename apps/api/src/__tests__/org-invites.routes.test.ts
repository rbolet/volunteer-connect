import { describe, expect, it } from "vitest"
import request from "supertest"
import { BFF_SECRET_HEADER } from "../middleware/bff-auth"
import { testApp, TEST_SECRET } from "./helpers"

const validRedeemBody = {
  token: "7K4M9XQP",
  authId: "auth_1",
  email: "new.user@example.com",
  name: "New User",
}

describe("GET /internal/invites/:token/validate", () => {
  it("requires the BFF secret", async () => {
    await request(testApp()).get("/internal/invites/7K4M9XQP/validate").expect(401)
  })

  it("404s on not_found", async () => {
    const app = testApp({
      orgInvites: { validate: async () => ({ ok: false, reason: "not_found" }) },
    })
    const res = await request(app)
      .get("/internal/invites/bad-token/validate")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .expect(404)
    expect(res.body.error).toBe("not_found")
  })

  it("410s on expired", async () => {
    const app = testApp({
      orgInvites: { validate: async () => ({ ok: false, reason: "expired" }) },
    })
    const res = await request(app)
      .get("/internal/invites/old-token/validate")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .expect(410)
    expect(res.body.error).toBe("expired")
  })

  it("409s on redeemed", async () => {
    const app = testApp({
      orgInvites: { validate: async () => ({ ok: false, reason: "redeemed" }) },
    })
    const res = await request(app)
      .get("/internal/invites/used-token/validate")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .expect(409)
    expect(res.body.error).toBe("redeemed")
  })

  it("200s with org_id/org_name on a valid token", async () => {
    const app = testApp({
      orgInvites: {
        validate: async () => ({ ok: true, org_id: "org_1", org_name: "Test AYSO" }),
      },
    })
    const res = await request(app)
      .get("/internal/invites/7K4M9XQP/validate")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .expect(200)
    expect(res.body).toEqual({ org_id: "org_1", org_name: "Test AYSO" })
  })
})

describe("POST /internal/invites/redeem", () => {
  it("requires the BFF secret", async () => {
    await request(testApp()).post("/internal/invites/redeem").send(validRedeemBody).expect(401)
  })

  it("400s on an invalid body", async () => {
    const res = await request(testApp())
      .post("/internal/invites/redeem")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .send({ token: "7K4M9XQP" })
      .expect(400)
    expect(res.body.error).toBe("invalid_input")
  })

  it("404s on not_found", async () => {
    const app = testApp({
      orgInvites: { redeem: async () => ({ ok: false, reason: "not_found" }) },
    })
    const res = await request(app)
      .post("/internal/invites/redeem")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .send(validRedeemBody)
      .expect(404)
    expect(res.body.error).toBe("not_found")
  })

  it("410s on expired", async () => {
    const app = testApp({ orgInvites: { redeem: async () => ({ ok: false, reason: "expired" }) } })
    const res = await request(app)
      .post("/internal/invites/redeem")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .send(validRedeemBody)
      .expect(410)
    expect(res.body.error).toBe("expired")
  })

  it("409s on redeemed", async () => {
    const app = testApp({ orgInvites: { redeem: async () => ({ ok: false, reason: "redeemed" }) } })
    const res = await request(app)
      .post("/internal/invites/redeem")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .send(validRedeemBody)
      .expect(409)
    expect(res.body.error).toBe("redeemed")
  })

  it("400s on email_mismatch", async () => {
    const app = testApp({
      orgInvites: { redeem: async () => ({ ok: false, reason: "email_mismatch" }) },
    })
    const res = await request(app)
      .post("/internal/invites/redeem")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .send(validRedeemBody)
      .expect(400)
    expect(res.body.error).toBe("email_mismatch")
  })

  it("200s with userId on success", async () => {
    const app = testApp({
      orgInvites: { redeem: async () => ({ ok: true, userId: "user_new" }) },
    })
    const res = await request(app)
      .post("/internal/invites/redeem")
      .set(BFF_SECRET_HEADER, TEST_SECRET)
      .send(validRedeemBody)
      .expect(200)
    expect(res.body).toEqual({ userId: "user_new" })
  })
})
