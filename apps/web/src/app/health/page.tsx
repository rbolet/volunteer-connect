import { HealthView, type HealthData } from "./HealthView"

async function getHealth(): Promise<HealthData> {
  const url = `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/health`
  try {
    const res = await fetch(url, {
      cache: "no-store",
    })
    return res.json()
  } catch {
    return { status: "unreachable" }
  }
}

export default async function HealthPage() {
  const health = await getHealth()
  return <HealthView health={health} />
}
