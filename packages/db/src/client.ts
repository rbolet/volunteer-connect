import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Prisma 7 has no built-in engine transport — a driver adapter is mandatory
// for runtime queries (the CLI/migrations manage their own connection).
// Single factory so every consumer (apps/api, seed scripts) constructs the
// client the same way.
export function createPrismaClient(
  connectionString: string | undefined = process.env.DATABASE_URL
): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot create a Prisma client")
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}
