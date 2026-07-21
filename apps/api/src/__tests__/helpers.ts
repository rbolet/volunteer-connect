import type { Application } from "express"
import type { ResolvedSession } from "@vc/types"
import { createApp } from "../app"
import type { Repos } from "../repositories"
import { BFF_SECRET_HEADER, SESSION_HEADER } from "../middleware/bff-auth"

export const TEST_SECRET = "test-bff-secret"

export const volunteerSession: ResolvedSession = {
  user_id: "user_vol",
  org_id: "org_demo",
  org_roles: [],
  team_roles: [{ team_id: "team_eagles", role: "volunteer" }],
  source: "demo",
}

export const adminSession: ResolvedSession = {
  ...volunteerSession,
  user_id: "user_admin",
  org_roles: ["admin"],
  team_roles: [],
}

// Every repo method throws unless a test overrides it — a route reaching an
// unexpected repo is a test failure, not silent behavior.
export function fakeRepos(overrides: {
  [K in keyof Repos]?: Partial<Repos[K]>
}): Repos {
  const reject = (name: string) => () => {
    throw new Error(`unexpected repo call: ${name}`)
  }
  return {
    demoSession: { resolve: reject("demoSession.resolve"), ...overrides.demoSession },
    signups: {
      listForOrg: reject("signups.listForOrg"),
      getDetail: reject("signups.getDetail"),
      create: reject("signups.create"),
      changeStatus: reject("signups.changeStatus"),
      ...overrides.signups,
    },
    signupTemplates: {
      listForOrg: reject("signupTemplates.listForOrg"),
      create: reject("signupTemplates.create"),
      createFromSignup: reject("signupTemplates.createFromSignup"),
      remove: reject("signupTemplates.remove"),
      ...overrides.signupTemplates,
    },
    slotResponses: {
      claim: reject("slotResponses.claim"),
      withdraw: reject("slotResponses.withdraw"),
      listForUser: reject("slotResponses.listForUser"),
      ...overrides.slotResponses,
    },
    slots: {
      add: reject("slots.add"),
      update: reject("slots.update"),
      remove: reject("slots.remove"),
      ...overrides.slots,
    },
    teams: { listWithPoints: reject("teams.listWithPoints"), ...overrides.teams },
  } as Repos
}

export function testApp(overrides: Parameters<typeof fakeRepos>[0] = {}): Application {
  process.env.TRUSTED_BFF_SECRET = TEST_SECRET
  return createApp(fakeRepos(overrides))
}

export function authHeaders(session: ResolvedSession = volunteerSession) {
  return {
    [BFF_SECRET_HEADER]: TEST_SECRET,
    [SESSION_HEADER]: JSON.stringify(session),
  }
}
