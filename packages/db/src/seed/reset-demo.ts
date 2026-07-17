import "dotenv/config"
import { createPrismaClient } from "../client"
import { seedDemoOrg } from "./generate"
import { wipeDemoOrg } from "./wipe"

// CLI entry: `pnpm --filter @vc/db db:reset-demo`. Wipe (if a demo org
// exists) then reseed. This is the script the future Railway cron job will
// invoke nightly (DEMO_MODE.md) — manual-only for now.
async function main() {
  const prisma = createPrismaClient()
  try {
    const existing = await prisma.organization.findFirst({ where: { is_demo: true } })
    if (existing) {
      console.log(`Wiping demo org ${existing.id} ("${existing.name}")...`)
      await wipeDemoOrg(prisma, existing.id)
    } else {
      console.log("No demo org found — seeding fresh.")
    }
    const summary = await seedDemoOrg(prisma)
    console.log("Demo org reseeded:")
    console.table(summary)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
