import type { PrismaClient } from "@vc/db"
import type {
  CreateSignupInput,
  ResolvedSession,
  SignupDetail,
  SignupListItem,
  SignupStatus,
} from "@vc/types"
import { evaluateStatusChange, type StatusChangeRejection } from "../lib/status-rules"

// Repository layer: all Prisma access for signups lives here, org-scoped on
// every query. The soft-delete client extension is still deferred
// (CROSSCONTEXT_TODOS.md) so every query filters deleted_at explicitly.

export type CreateSignupResult =
  { ok: true; id: string } | { ok: false; reason: "no_active_season" }

export type StatusChangeResult =
  { ok: true } | { ok: false; reason: "not_found" | StatusChangeRejection }

export interface SignupsRepo {
  listForOrg(orgId: string, opts: { includeDrafts: boolean }): Promise<SignupListItem[]>
  getDetail(orgId: string, signupId: string): Promise<SignupDetail | null>
  create(args: {
    orgId: string
    adminId: string
    input: CreateSignupInput
  }): Promise<CreateSignupResult>
  changeStatus(args: {
    session: ResolvedSession
    signupId: string
    target: SignupStatus
  }): Promise<StatusChangeResult>
}

const ACTIVE_RESPONSES = { deleted_at: null, status: { not: "declined" as const } }

export function createSignupsRepo(prisma: PrismaClient): SignupsRepo {
  return {
    async listForOrg(orgId, { includeDrafts }) {
      const signups = await prisma.signup.findMany({
        where: {
          org_id: orgId,
          deleted_at: null,
          ...(includeDrafts ? {} : { status: { not: "draft" as const } }),
        },
        orderBy: { created_at: "asc" },
        include: {
          event: true,
          eligibleRoles: true,
          slots: {
            where: { deleted_at: null },
            include: { responses: { where: ACTIVE_RESPONSES, select: { id: true } } },
          },
        },
      })
      return signups.map((s) => ({
        id: s.id,
        title: s.title,
        mode: s.mode,
        status: s.status,
        description: s.description,
        opensAt: s.opens_at?.toISOString() ?? null,
        closesAt: s.closes_at?.toISOString() ?? null,
        eligibleRoles: s.eligibleRoles.map((r) => r.role),
        eventName: s.event && s.event.deleted_at === null ? s.event.name : null,
        totalSeats: s.slots.reduce((sum, slot) => sum + slot.capacity, 0),
        claimedSeats: s.slots.reduce((sum, slot) => sum + slot.responses.length, 0),
      }))
    },

    async getDetail(orgId, signupId) {
      const s = await prisma.signup.findFirst({
        where: { id: signupId, org_id: orgId, deleted_at: null },
        include: {
          event: true,
          eligibleRoles: true,
          slots: {
            where: { deleted_at: null },
            orderBy: { created_at: "asc" },
            include: {
              responses: {
                where: { deleted_at: null },
                orderBy: { created_at: "asc" },
                include: { user: true, team: true },
              },
            },
          },
        },
      })
      if (!s) return null
      const slots = s.slots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        pointValue: slot.point_value,
        capacity: slot.capacity,
        claimedCount: slot.responses.filter((r) => r.status !== "declined").length,
        responses: slot.responses.map((r) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user.name,
          teamId: r.team_id,
          teamName: r.team.name,
          teamNumber: r.team.team_number,
          status: r.status,
          rank: r.rank,
        })),
      }))
      return {
        id: s.id,
        title: s.title,
        mode: s.mode,
        status: s.status,
        description: s.description,
        opensAt: s.opens_at?.toISOString() ?? null,
        closesAt: s.closes_at?.toISOString() ?? null,
        eligibleRoles: s.eligibleRoles.map((r) => r.role),
        eventName: s.event && s.event.deleted_at === null ? s.event.name : null,
        totalSeats: slots.reduce((sum, slot) => sum + slot.capacity, 0),
        claimedSeats: slots.reduce((sum, slot) => sum + slot.claimedCount, 0),
        slots,
      }
    },

    async create({ orgId, adminId, input }) {
      // New signups attach to the active season; events are deferred (null).
      const season = await prisma.season.findFirst({
        where: { org_id: orgId, is_active: true, deleted_at: null },
      })
      if (!season) return { ok: false, reason: "no_active_season" }
      const signup = await prisma.signup.create({
        data: {
          org_id: orgId,
          season_id: season.id,
          title: input.title,
          description: input.description ?? null,
          // RANKED_CHOICE has no volunteer flow yet — creation is
          // DIRECT_CLAIM-only regardless of client input.
          mode: "DIRECT_CLAIM",
          status: "draft",
          created_by: adminId,
          updated_by: adminId,
          eligibleRoles: { create: input.eligibleRoles.map((role) => ({ role })) },
          slots: {
            create: input.slots.map((s) => ({
              label: s.label,
              point_value: s.pointValue,
              capacity: s.capacity,
              created_by: adminId,
              updated_by: adminId,
            })),
          },
        },
      })
      return { ok: true, id: signup.id }
    },

    async changeStatus({ session, signupId, target }) {
      return prisma.$transaction(async (tx) => {
        const signup = await tx.signup.findFirst({
          where: { id: signupId, org_id: session.org_id, deleted_at: null },
        })
        if (!signup) return { ok: false as const, reason: "not_found" as const }
        const verdict = evaluateStatusChange(signup.status, target)
        if (verdict !== "ok") return { ok: false as const, reason: verdict }

        await tx.signup.update({
          where: { id: signupId },
          data: { status: target, updated_by: session.user_id },
        })

        // Finalizing confirms all completions in bulk (demo simplification of
        // DATA_MODEL.md's per-response "confirm completion"): every
        // non-declined response is completed and its slot's points are awarded
        // to the responder's chosen team. Runs only on the transition into
        // `finalized` (terminal), so points can never be awarded twice.
        if (target === "finalized") {
          const responses = await tx.slotResponse.findMany({
            where: {
              deleted_at: null,
              status: { not: "declined" },
              slot: { deleted_at: null, signup_id: signupId },
            },
            include: { slot: { select: { point_value: true } } },
          })
          if (responses.length > 0) {
            await tx.slotResponse.updateMany({
              where: { id: { in: responses.map((r) => r.id) } },
              data: { status: "completed", updated_by: session.user_id },
            })
            await tx.pointsLedger.createMany({
              data: responses.map((r) => ({
                team_id: r.team_id,
                slot_response_id: r.id,
                points: r.slot.point_value,
                awarded_by: session.user_id,
                created_by: session.user_id,
                updated_by: session.user_id,
              })),
            })
          }
        }
        return { ok: true as const }
      })
    },
  }
}
