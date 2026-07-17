import "dotenv/config"
import { createPrismaClient } from "../client"
import { seedDemoOrg } from "./generate"

// CLI entry: `pnpm --filter @vc/db db:seed`. Refuses to double-seed — the
// demo org must be unique (DEMO_MODE.md), so an existing one means you want
// `db:reset-demo` instead.
async function main() {
  const prisma = createPrismaClient()
  try {
    const existing = await prisma.organization.findFirst({ where: { is_demo: true } })
    if (existing) {
      console.error(
        `A demo org already exists (${existing.id} — "${existing.name}"). ` +
          `Run \`pnpm --filter @vc/db db:reset-demo\` to wipe and reseed it.`
      )
      process.exitCode = 1
      return
    }
    const summary = await seedDemoOrg(prisma)
    console.log("Demo org seeded:")
    console.table(summary)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
