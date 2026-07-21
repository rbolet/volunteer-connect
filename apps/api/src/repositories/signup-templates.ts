import type { PrismaClient, Prisma } from "@vc/db"
import {
  createSignupTemplateSchema,
  signupTemplateEligibleRolesSchema,
  signupTemplateSlotSchema,
} from "@vc/zod"
import type { CreateSignupTemplateInput, SignupTemplateListItem } from "@vc/types"

// Repository layer for SignupTemplate. This is the ONLY module that reads or
// writes the `slots`/`eligibleRoles` JSON columns directly — every value in
// or out is parsed through the Zod schemas below, so a future move to
// relational tables (see schema.prisma's SignupTemplate comment) only
// touches this file plus a data migration.

export type CreateSignupTemplateResult = { ok: true; id: string }
export type CreateFromSignupResult = { ok: true; id: string } | { ok: false; reason: "not_found" }
export type RemoveTemplateResult = { ok: true } | { ok: false; reason: "not_found" }

export interface SignupTemplatesRepo {
  listForOrg(orgId: string): Promise<SignupTemplateListItem[]>
  create(args: {
    orgId: string
    adminId: string
    input: CreateSignupTemplateInput
  }): Promise<CreateSignupTemplateResult>
  createFromSignup(args: {
    orgId: string
    adminId: string
    signupId: string
    title: string
  }): Promise<CreateFromSignupResult>
  remove(args: { orgId: string; templateId: string }): Promise<RemoveTemplateResult>
}

function toListItem(row: {
  id: string
  title: string
  description: string | null
  eligibleRoles: Prisma.JsonValue
  slots: Prisma.JsonValue
}): SignupTemplateListItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eligibleRoles: signupTemplateEligibleRolesSchema.parse(row.eligibleRoles),
    slots: signupTemplateSlotSchema.array().parse(row.slots),
  }
}

export function createSignupTemplatesRepo(prisma: PrismaClient): SignupTemplatesRepo {
  return {
    async listForOrg(orgId) {
      const templates = await prisma.signupTemplate.findMany({
        where: { org_id: orgId, deleted_at: null },
        orderBy: { created_at: "asc" },
      })
      return templates.map(toListItem)
    },

    async create({ orgId, adminId, input }) {
      const parsed = createSignupTemplateSchema.parse(input)
      const template = await prisma.signupTemplate.create({
        data: {
          org_id: orgId,
          title: parsed.title,
          description: parsed.description ?? null,
          eligibleRoles: parsed.eligibleRoles as Prisma.InputJsonValue,
          slots: parsed.slots as Prisma.InputJsonValue,
          created_by: adminId,
          updated_by: adminId,
        },
      })
      return { ok: true, id: template.id }
    },

    async createFromSignup({ orgId, adminId, signupId, title }) {
      const signup = await prisma.signup.findFirst({
        where: { id: signupId, org_id: orgId, deleted_at: null },
        include: {
          eligibleRoles: true,
          slots: { where: { deleted_at: null }, orderBy: { created_at: "asc" } },
        },
      })
      if (!signup) return { ok: false, reason: "not_found" }

      const parsed = createSignupTemplateSchema.parse({
        title,
        description: signup.description,
        eligibleRoles: signup.eligibleRoles.map((r) => r.role),
        slots: signup.slots.map((s) => ({
          label: s.label,
          pointValue: s.point_value,
          capacity: s.capacity,
        })),
      })
      const template = await prisma.signupTemplate.create({
        data: {
          org_id: orgId,
          title: parsed.title,
          description: parsed.description ?? null,
          eligibleRoles: parsed.eligibleRoles as Prisma.InputJsonValue,
          slots: parsed.slots as Prisma.InputJsonValue,
          created_by: adminId,
          updated_by: adminId,
        },
      })
      return { ok: true, id: template.id }
    },

    async remove({ orgId, templateId }) {
      const template = await prisma.signupTemplate.findFirst({
        where: { id: templateId, org_id: orgId, deleted_at: null },
      })
      if (!template) return { ok: false, reason: "not_found" }
      // Hard delete: nothing FKs into a template row (unlike SignupSlot, which
      // needs the soft-delete convention's care around SlotResponse), and the
      // soft-delete extension is still deferred (CROSSCONTEXT_TODOS.md).
      await prisma.signupTemplate.delete({ where: { id: templateId } })
      return { ok: true }
    },
  }
}
