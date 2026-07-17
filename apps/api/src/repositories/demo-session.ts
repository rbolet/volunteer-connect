import type { PrismaClient } from "@vc/db"
import { demoHeroUsers } from "@vc/db/seed/demo-data"
import type { DemoIdentity, DemoSessionResponse } from "@vc/types"

// Resolves one of the fixed demo identities (DEMO_MODE.md / AUTH.md's
// DemoSessionResolver) into a full ResolvedSession. The demo org is located
// by its is_demo flag — the DB is the single source of truth, never request
// input. Returns null when the demo org/users haven't been seeded.
export interface DemoSessionRepo {
  resolve(identity: DemoIdentity): Promise<DemoSessionResponse | null>
}

export function createDemoSessionRepo(prisma: PrismaClient): DemoSessionRepo {
  return {
    async resolve(identity) {
      const hero = demoHeroUsers.find((u) => u.demoIdentity === identity)
      if (!hero) return null
      const org = await prisma.organization.findFirst({
        where: { is_demo: true, deleted_at: null },
      })
      if (!org) return null
      const user = await prisma.user.findFirst({
        where: { auth_id: hero.authId, org_id: org.id, deleted_at: null },
        include: {
          orgRoles: { where: { org_id: org.id } },
          teamMemberships: { where: { team: { deleted_at: null } } },
        },
      })
      if (!user) return null
      return {
        identity,
        user: { id: user.id, name: user.name, email: user.email },
        session: {
          user_id: user.id,
          org_id: org.id,
          org_roles: user.orgRoles.map((r) => r.role),
          team_roles: user.teamMemberships.map((m) => ({ team_id: m.team_id, role: m.role })),
          source: "demo",
        },
      }
    },
  }
}
