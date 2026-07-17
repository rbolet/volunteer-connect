import { describe, expect, it, vi } from "vitest"
import request from "supertest"
import type { SignupDetail } from "@vc/types"
import { adminSession, authHeaders, testApp, volunteerSession } from "./helpers"

const openDetail: SignupDetail = {
  id: "signup_ref",
  title: "Referee Tent Duty — Saturday",
  mode: "DIRECT_CLAIM",
  status: "open",
  description: null,
  opensAt: null,
  closesAt: null,
  eligibleRoles: ["volunteer", "referee"],
  eventName: null,
  totalSeats: 4,
  claimedSeats: 2,
  slots: [
    {
      id: "slot_1",
      label: "Ref Tent 8:00–9:00 AM",
      pointValue: 1,
      capacity: 2,
      claimedCount: 2,
      responses: [
        {
          id: "resp_own",
          userId: volunteerSession.user_id,
          userName: "Sam Rodriguez",
          teamId: "team_eagles",
          teamName: "Eagles",
          teamNumber: 356,
          status: "pending",
          rank: null,
        },
        {
          id: "resp_other",
          userId: "user_other",
          userName: "Tom Baker",
          teamId: "team_lightning",
          teamName: "Lightning",
          teamNumber: 305,
          status: "pending",
          rank: null,
        },
      ],
    },
  ],
}

describe("GET /signups", () => {
  it("passes includeDrafts=false for volunteers", async () => {
    const listForOrg = vi.fn().mockResolvedValue([])
    const app = testApp({ signups: { listForOrg } })
    await request(app).get("/signups").set(authHeaders(volunteerSession)).expect(200)
    expect(listForOrg).toHaveBeenCalledWith("org_demo", { includeDrafts: false })
  })

  it("passes includeDrafts=true for admins", async () => {
    const listForOrg = vi.fn().mockResolvedValue([])
    const app = testApp({ signups: { listForOrg } })
    await request(app).get("/signups").set(authHeaders(adminSession)).expect(200)
    expect(listForOrg).toHaveBeenCalledWith("org_demo", { includeDrafts: true })
  })
})

describe("GET /signups/:id", () => {
  it("404s on unknown signup", async () => {
    const app = testApp({ signups: { getDetail: async () => null } })
    await request(app).get("/signups/nope").set(authHeaders()).expect(404)
  })

  it("404s drafts for non-admins", async () => {
    const draft = { ...openDetail, status: "draft" as const }
    const app = testApp({ signups: { getDetail: async () => draft } })
    await request(app).get("/signups/signup_ref").set(authHeaders(volunteerSession)).expect(404)
  })

  it("redacts other users' responses while open, keeping claimedCount", async () => {
    const app = testApp({ signups: { getDetail: async () => structuredClone(openDetail) } })
    const res = await request(app)
      .get("/signups/signup_ref")
      .set(authHeaders(volunteerSession))
      .expect(200)
    const slot = res.body.signup.slots[0]
    expect(slot.responses).toHaveLength(1)
    expect(slot.responses[0].id).toBe("resp_own")
    expect(slot.claimedCount).toBe(2)
  })

  it("returns the full roster to admins while open", async () => {
    const app = testApp({ signups: { getDetail: async () => structuredClone(openDetail) } })
    const res = await request(app)
      .get("/signups/signup_ref")
      .set(authHeaders(adminSession))
      .expect(200)
    expect(res.body.signup.slots[0].responses).toHaveLength(2)
  })

  it("returns the full roster to everyone once finalized", async () => {
    const finalized = { ...structuredClone(openDetail), status: "finalized" as const }
    const app = testApp({ signups: { getDetail: async () => finalized } })
    const res = await request(app)
      .get("/signups/signup_ref")
      .set(authHeaders(volunteerSession))
      .expect(200)
    expect(res.body.signup.slots[0].responses).toHaveLength(2)
  })
})
