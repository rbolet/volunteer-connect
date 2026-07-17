import { describe, expect, it } from "vitest"
import {
  myResponseViewSchema,
  signupDetailSchema,
  signupListItemSchema,
  teamWithPointsSchema,
} from "../responses"

const listItem = {
  id: "signup_1",
  title: "Referee Tent Duty — Saturday",
  mode: "DIRECT_CLAIM",
  status: "open",
  description: null,
  opensAt: "2026-07-01T00:00:00.000Z",
  closesAt: null,
  eligibleRoles: ["volunteer", "referee"],
  eventName: "Fall 2026 Game Weekend",
  totalSeats: 16,
  claimedSeats: 5,
}

describe("signupListItemSchema", () => {
  it("accepts a valid list item", () => {
    expect(signupListItemSchema.parse(listItem)).toEqual(listItem)
  })

  it("rejects non-ISO datetimes", () => {
    expect(signupListItemSchema.safeParse({ ...listItem, opensAt: "yesterday" }).success).toBe(
      false
    )
  })

  it("rejects negative seat counts", () => {
    expect(signupListItemSchema.safeParse({ ...listItem, claimedSeats: -1 }).success).toBe(false)
  })
})

describe("signupDetailSchema", () => {
  it("accepts a detail payload with slots and responses", () => {
    const detail = {
      ...listItem,
      slots: [
        {
          id: "slot_1",
          label: "Ref Tent 8:00–9:00 AM",
          pointValue: 1,
          capacity: 2,
          claimedCount: 1,
          responses: [
            {
              id: "resp_1",
              userId: "user_1",
              userName: "Tom Baker",
              teamId: "team_1",
              teamName: "Lightning",
              teamNumber: 305,
              status: "pending",
              rank: null,
            },
          ],
        },
      ],
    }
    expect(signupDetailSchema.parse(detail)).toEqual(detail)
  })

  it("rejects a response with an invalid status", () => {
    const detail = {
      ...listItem,
      slots: [
        {
          id: "slot_1",
          label: "Ref Tent",
          pointValue: 1,
          capacity: 2,
          claimedCount: 1,
          responses: [
            {
              id: "resp_1",
              userId: "u",
              userName: "n",
              teamId: "t",
              teamName: "n",
              teamNumber: null,
              status: "approved",
              rank: null,
            },
          ],
        },
      ],
    }
    expect(signupDetailSchema.safeParse(detail).success).toBe(false)
  })
})

describe("teamWithPointsSchema", () => {
  it("accepts a team with computed totals", () => {
    const team = {
      id: "team_1",
      name: "Sharks",
      teamNumber: 351,
      color: "Blue",
      totalPoints: 18,
      memberCount: 4,
    }
    expect(teamWithPointsSchema.parse(team)).toEqual(team)
  })

  it("rejects negative totals", () => {
    const team = { id: "t", name: "Sharks", totalPoints: -5, memberCount: 0 }
    expect(teamWithPointsSchema.safeParse(team).success).toBe(false)
  })
})

describe("myResponseViewSchema", () => {
  it("accepts a claim row", () => {
    const row = {
      id: "resp_1",
      status: "pending",
      slotId: "slot_1",
      slotLabel: "Ref Tent 10:00–11:00 AM",
      pointValue: 1,
      signupId: "signup_1",
      signupTitle: "Referee Tent Duty — Saturday",
      signupStatus: "open",
      teamId: "team_1",
      teamName: "Thunder",
    }
    expect(myResponseViewSchema.parse(row)).toEqual(row)
  })
})
