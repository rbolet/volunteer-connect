import { Prisma, type PrismaClient } from "@vc/db"
import type { MyResponseView, ResolvedSession } from "@vc/types"
import {
  evaluateClaim,
  evaluateWithdraw,
  type ClaimRejection,
  type WithdrawRejection,
} from "../lib/claim-rules"

export type ClaimResult = { ok: true; responseId: string } | { ok: false; reason: ClaimRejection }
export type WithdrawResult = { ok: true } | { ok: false; reason: WithdrawRejection }

export interface SlotResponsesRepo {
  claim(args: { session: ResolvedSession; slotId: string; teamId: string }): Promise<ClaimResult>
  withdraw(args: { session: ResolvedSession; responseId: string }): Promise<WithdrawResult>
  listForUser(orgId: string, userId: string): Promise<MyResponseView[]>
}

const SERIALIZATION_FAILURE = "P2034"
const UNIQUE_VIOLATION = "P2002"
const CLAIM_ATTEMPTS = 3

export function createSlotResponsesRepo(prisma: PrismaClient): SlotResponsesRepo {
  async function claimOnce(args: {
    session: ResolvedSession
    slotId: string
    teamId: string
  }): Promise<ClaimResult> {
    const { session, slotId, teamId } = args
    return prisma.$transaction(
      async (tx) => {
        const slot = await tx.signupSlot.findFirst({
          where: {
            id: slotId,
            deleted_at: null,
            signup: { org_id: session.org_id, deleted_at: null },
          },
          include: {
            signup: { include: { eligibleRoles: true } },
            responses: {
              where: { deleted_at: null, status: { not: "declined" as const } },
              select: { user_id: true },
            },
          },
        })
        const verdict = evaluateClaim({
          slot: slot && {
            capacity: slot.capacity,
            claimedCount: slot.responses.length,
            signup: {
              status: slot.signup.status,
              mode: slot.signup.mode,
              eligibleRoles: slot.signup.eligibleRoles.map((r) => r.role),
            },
          },
          session,
          teamId,
          alreadyClaimed: slot?.responses.some((r) => r.user_id === session.user_id) ?? false,
        })
        if (verdict !== "ok") return { ok: false as const, reason: verdict }
        const created = await tx.slotResponse.create({
          data: {
            slot_id: slotId,
            user_id: session.user_id,
            team_id: teamId,
            status: "pending",
            created_by: session.user_id,
            updated_by: session.user_id,
          },
        })
        return { ok: true as const, responseId: created.id }
      },
      // Serializable so two concurrent claims can't both pass the capacity
      // check (TESTING.md's slot-claim race condition).
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  }

  return {
    async claim(args) {
      for (let attempt = 1; ; attempt++) {
        try {
          return await claimOnce(args)
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError) {
            if (err.code === UNIQUE_VIOLATION) return { ok: false, reason: "already_claimed" }
            if (err.code === SERIALIZATION_FAILURE && attempt < CLAIM_ATTEMPTS) continue
          }
          throw err
        }
      }
    },

    async withdraw({ session, responseId }) {
      const response = await prisma.slotResponse.findFirst({
        where: {
          id: responseId,
          deleted_at: null,
          slot: { signup: { org_id: session.org_id, deleted_at: null } },
        },
        include: { slot: { include: { signup: true } } },
      })
      const verdict = evaluateWithdraw({
        response: response && {
          userId: response.user_id,
          status: response.status,
          signupStatus: response.slot.signup.status,
        },
        session,
      })
      if (verdict !== "ok") return { ok: false, reason: verdict }
      // Hard delete on purpose: withdrawing while open removes the response
      // entirely (DATA_MODEL.md), and the (user_id, slot_id) unique constraint
      // must be free for a later re-claim.
      await prisma.slotResponse.delete({ where: { id: responseId } })
      return { ok: true }
    },

    async listForUser(orgId, userId) {
      const responses = await prisma.slotResponse.findMany({
        where: {
          user_id: userId,
          deleted_at: null,
          slot: { deleted_at: null, signup: { org_id: orgId, deleted_at: null } },
        },
        orderBy: { created_at: "asc" },
        include: { slot: { include: { signup: true } }, team: true },
      })
      return responses.map((r) => ({
        id: r.id,
        status: r.status,
        slotId: r.slot_id,
        slotLabel: r.slot.label,
        pointValue: r.slot.point_value,
        signupId: r.slot.signup.id,
        signupTitle: r.slot.signup.title,
        signupStatus: r.slot.signup.status,
        teamId: r.team_id,
        teamName: r.team.name,
      }))
    },
  }
}
