import type { PrismaClient } from "@prisma/client"

/**
 * Hard-deletes every row scoped to the demo org, in FK dependency order.
 * Deliberately a real DELETE, not the (future) soft-delete path — see
 * DEMO_MODE.md's reset-job section: soft-deleting on every reset would pile
 * up deleted_at rows forever instead of reclaiming a clean slate. Scoping is
 * always via the org relation chain so nothing outside the demo org can ever
 * be touched.
 */
export async function wipeDemoOrg(prisma: PrismaClient, orgId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.pointsLedger.deleteMany({ where: { team: { org_id: orgId } } })
      await tx.slotResponse.deleteMany({ where: { team: { org_id: orgId } } })
      await tx.signupSlot.deleteMany({ where: { signup: { org_id: orgId } } })
      await tx.signupEligibleRole.deleteMany({ where: { signup: { org_id: orgId } } })
      await tx.signup.deleteMany({ where: { org_id: orgId } })
      await tx.event.deleteMany({ where: { org_id: orgId } })
      await tx.teamMembership.deleteMany({ where: { team: { org_id: orgId } } })
      await tx.team.deleteMany({ where: { org_id: orgId } })
      await tx.season.deleteMany({ where: { org_id: orgId } })
      await tx.orgRole.deleteMany({ where: { org_id: orgId } })
      await tx.user.deleteMany({ where: { org_id: orgId } })
      await tx.organization.delete({ where: { id: orgId } })
    },
    { maxWait: 30_000, timeout: 120_000 }
  )
}
