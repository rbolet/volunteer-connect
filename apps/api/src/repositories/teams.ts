import type { PrismaClient } from "@vc/db"
import type { TeamWithPoints } from "@vc/types"

export interface TeamsRepo {
  listWithPoints(orgId: string): Promise<TeamWithPoints[]>
}

export function createTeamsRepo(prisma: PrismaClient): TeamsRepo {
  return {
    async listWithPoints(orgId) {
      const [teams, sums] = await Promise.all([
        prisma.team.findMany({
          where: { org_id: orgId, deleted_at: null },
          orderBy: { name: "asc" },
          include: { _count: { select: { memberships: true } } },
        }),
        // Point totals are always computed from the ledger, never stored
        // (DATA_MODEL.md — avoids running-total drift).
        prisma.pointsLedger.groupBy({
          by: ["team_id"],
          where: { deleted_at: null, team: { org_id: orgId, deleted_at: null } },
          _sum: { points: true },
        }),
      ])
      const pointsByTeam = new Map(sums.map((s) => [s.team_id, s._sum.points ?? 0]))
      return teams.map((t) => ({
        id: t.id,
        name: t.name,
        teamNumber: t.team_number,
        color: t.color,
        totalPoints: pointsByTeam.get(t.id) ?? 0,
        memberCount: t._count.memberships,
      }))
    },
  }
}
