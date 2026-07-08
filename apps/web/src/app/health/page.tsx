import { HealthView, type HealthData } from "./HealthView"

async function getHealth(): Promise<HealthData> {
  try {
    const res = await fetch(
      `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/health`,
      { cache: "no-store" }
    )
    return res.json()
  } catch {
    return { status: "unreachable" }
  }
}

export default async function HealthPage() {
  const health = await getHealth()
  return <HealthView health={health} />
}
