import type { PrismaClient } from "@vc/db"
import type { ResolvedSession, SignupSlotInput } from "@vc/types"
import { evaluateSlotEdit, type SlotEditRejection } from "../lib/status-rules"

export type SlotMutationResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; id: string })
  | { ok: false; reason: "not_found" | SlotEditRejection }

export interface SlotsRepo {
  add(args: {
    session: ResolvedSession
    signupId: string
    input: SignupSlotInput
  }): Promise<SlotMutationResult<string>>
  update(args: {
    session: ResolvedSession
    slotId: string
    input: SignupSlotInput
  }): Promise<SlotMutationResult>
  remove(args: { session: ResolvedSession; slotId: string }): Promise<SlotMutationResult>
}

const ACTIVE_RESPONSES = { deleted_at: null, status: { not: "declined" as const } }

export function createSlotsRepo(prisma: PrismaClient): SlotsRepo {
  return {
    async add({ session, signupId, input }) {
      const signup = await prisma.signup.findFirst({
        where: { id: signupId, org_id: session.org_id, deleted_at: null },
      })
      if (!signup) return { ok: false, reason: "not_found" }
      const verdict = evaluateSlotEdit({
        signupStatus: signup.status,
        claimedCount: 0,
        action: "add",
      })
      if (verdict !== "ok") return { ok: false, reason: verdict }
      const slot = await prisma.signupSlot.create({
        data: {
          signup_id: signupId,
          label: input.label,
          point_value: input.pointValue,
          capacity: input.capacity,
          created_by: session.user_id,
          updated_by: session.user_id,
        },
      })
      return { ok: true, id: slot.id }
    },

    async update({ session, slotId, input }) {
      return prisma.$transaction(async (tx) => {
        const slot = await tx.signupSlot.findFirst({
          where: {
            id: slotId,
            deleted_at: null,
            signup: { org_id: session.org_id, deleted_at: null },
          },
          include: {
            signup: { select: { status: true } },
            responses: { where: ACTIVE_RESPONSES, select: { id: true } },
          },
        })
        if (!slot) return { ok: false as const, reason: "not_found" as const }
        const verdict = evaluateSlotEdit({
          signupStatus: slot.signup.status,
          claimedCount: slot.responses.length,
          action: "update",
          newCapacity: input.capacity,
        })
        if (verdict !== "ok") return { ok: false as const, reason: verdict }
        await tx.signupSlot.update({
          where: { id: slotId },
          data: {
            label: input.label,
            point_value: input.pointValue,
            capacity: input.capacity,
            updated_by: session.user_id,
          },
        })
        return { ok: true as const }
      })
    },

    async remove({ session, slotId }) {
      return prisma.$transaction(async (tx) => {
        const slot = await tx.signupSlot.findFirst({
          where: {
            id: slotId,
            deleted_at: null,
            signup: { org_id: session.org_id, deleted_at: null },
          },
          include: {
            signup: { select: { status: true } },
            responses: { where: ACTIVE_RESPONSES, select: { id: true } },
          },
        })
        if (!slot) return { ok: false as const, reason: "not_found" as const }
        const verdict = evaluateSlotEdit({
          signupStatus: slot.signup.status,
          claimedCount: slot.responses.length,
          action: "delete",
        })
        if (verdict !== "ok") return { ok: false as const, reason: verdict }
        // Hard delete: by rule the slot has zero non-declined responses, and
        // the soft-delete extension is still deferred (CROSSCONTEXT_TODOS.md).
        // Any declined responses must go first (FK).
        await tx.slotResponse.deleteMany({ where: { slot_id: slotId } })
        await tx.signupSlot.delete({ where: { id: slotId } })
        return { ok: true as const }
      })
    },
  }
}
