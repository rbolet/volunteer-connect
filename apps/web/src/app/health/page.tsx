import { HealthView, type HealthData } from "./HealthView"
import { introspect } from "@vc/error-utils"
import { logger } from "@vc/logger"

const fetchHealth = introspect(async function fetchHealth(url: string): Promise<HealthData> {
  const res = await fetch(url, {
    cache: "no-store",
  })
  return res.json()
})

async function getHealth(): Promise<HealthData> {
  const url = `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/health`
  try {
    return await fetchHealth(url)
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err), { url })
    return { status: "unreachable" }
  }
}

export default async function HealthPage() {
  const health = await getHealth()
  return <HealthView health={health} />
}
