import { Prisma, type PrismaClient } from "@vc/db"

export type ValidateResult =
  | { ok: true; org_id: string; org_name: string }
  | { ok: false; reason: "not_found" | "expired" | "redeemed" }

export type RedeemResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_found" | "expired" | "redeemed" | "email_mismatch" }

export interface OrgInvitesRepo {
  validate(token: string): Promise<ValidateResult>
  redeem(
    token: string,
    input: { authId: string; email: string; name: string }
  ): Promise<RedeemResult>
}

const UNIQUE_VIOLATION = "P2002"

export function createOrgInvitesRepo(prisma: PrismaClient): OrgInvitesRepo {
  return {
    async validate(token) {
      const invite = await prisma.orgInvite.findFirst({
        where: { token, deleted_at: null },
        include: { org: true },
      })
      if (!invite) return { ok: false, reason: "not_found" }
      if (invite.redeemed_at) return { ok: false, reason: "redeemed" }
      if (invite.expires_at < new Date()) return { ok: false, reason: "expired" }
      return { ok: true, org_id: invite.org_id, org_name: invite.org.name }
    },

    async redeem(token, input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const invite = await tx.orgInvite.findFirst({ where: { token, deleted_at: null } })
          if (!invite) return { ok: false as const, reason: "not_found" as const }
          if (invite.redeemed_at) return { ok: false as const, reason: "redeemed" as const }
          if (invite.expires_at < new Date()) {
            return { ok: false as const, reason: "expired" as const }
          }
          if (invite.email && invite.email !== input.email) {
            return { ok: false as const, reason: "email_mismatch" as const }
          }
          const user = await tx.user.create({
            data: {
              org_id: invite.org_id,
              auth_id: input.authId,
              email: input.email,
              name: input.name,
              created_by: input.authId,
              updated_by: input.authId,
            },
          })
          await tx.orgInvite.update({
            where: { id: invite.id },
            data: { redeemed_at: new Date(), redeemed_by: user.id, updated_by: user.id },
          })
          return { ok: true as const, userId: user.id }
        })
      } catch (err) {
        // Two concurrent redeems of the same token can both pass the
        // redeemed_at check before either commits (small accepted TOCTOU
        // window). If they share an auth_id, User.auth_id's unique
        // constraint is the real backstop — treat it the same as "redeemed".
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_VIOLATION) {
          return { ok: false, reason: "redeemed" }
        }
        throw err
      }
    },
  }
}
