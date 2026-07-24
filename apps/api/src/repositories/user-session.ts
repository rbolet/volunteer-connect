import type { PrismaClient } from "@vc/db"
import type { AppSessionResponse } from "@vc/types"

// Resolves a Supabase-authenticated user (by auth_id) into a full
// ResolvedSession. Returns null when no User row exists yet for this
// auth_id — the "needs org" signal the web layer's getAppSession() keys off
// of (REAL_AUTH_IMPLEMENTATION.md Phase 2), not an error.
export interface UserSessionRepo {
  resolve(authId: string): Promise<AppSessionResponse | null>
}

export function createUserSessionRepo(prisma: PrismaClient): UserSessionRepo {
  return {
    async resolve(authId) {
      const user = await prisma.user.findFirst({
        where: { auth_id: authId, deleted_at: null },
        include: {
          orgRoles: true,
          teamMemberships: { where: { team: { deleted_at: null } } },
        },
      })
      if (!user) return null
      return {
        user: { id: user.id, name: user.name, email: user.email },
        session: {
          user_id: user.id,
          org_id: user.org_id,
          org_roles: user.orgRoles.map((r) => r.role),
          team_roles: user.teamMemberships.map((m) => ({ team_id: m.team_id, role: m.role })),
          source: "supabase",
        },
      }
    },
  }
}
