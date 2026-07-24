import "dotenv/config"
import { randomInt } from "node:crypto"
import { parseArgs } from "node:util"
import { createPrismaClient } from "../src/client"

// CLI: `pnpm --filter @vc/db exec tsx scripts/create-invite.ts --org-id <id>
// [--email <pin>] [--days 14]`. The only way to issue an OrgInvite until an
// admin-facing UI exists (REAL_AUTH_IMPLEMENTATION.md Decision 2) — dev-only
// tool, kept simple on purpose.

// Excludes 0/O/1/I/L to avoid transcription errors when read aloud or
// hand-typed (REAL_AUTH_IMPLEMENTATION.md's Token format).
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const TOKEN_LENGTH = 8

function generateToken(): string {
  let token = ""
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += ALPHABET[randomInt(ALPHABET.length)]
  }
  return token
}

async function main() {
  const { values } = parseArgs({
    options: {
      "org-id": { type: "string" },
      email: { type: "string" },
      days: { type: "string", default: "14" },
    },
  })

  const prisma = createPrismaClient()
  try {
    const org = values["org-id"]
      ? await prisma.organization.findFirst({ where: { id: values["org-id"], deleted_at: null } })
      : await prisma.organization.findFirst({ where: { is_demo: false, deleted_at: null } })

    if (!org) {
      console.error(
        values["org-id"]
          ? `No org found with id "${values["org-id"]}".`
          : "No non-demo org found — pass --org-id explicitly."
      )
      process.exitCode = 1
      return
    }

    const days = Number(values.days)
    if (!Number.isFinite(days) || days <= 0) {
      console.error(`Invalid --days value: "${values.days}"`)
      process.exitCode = 1
      return
    }

    const token = generateToken()
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    await prisma.orgInvite.create({
      data: {
        org_id: org.id,
        token,
        email: values.email ?? null,
        expires_at: expiresAt,
      },
    })

    console.log(
      `Invite created for org ${org.id} ("${org.name}"), expires ${expiresAt.toISOString()}`
    )
    console.log(`Token: ${token}`)
    console.log(`URL: /sign-up?invite=${token}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
