export type HealthData = { status: string; timestamp?: string }

export function HealthView({ health }: { health: HealthData }) {
  const ok = health.status === "ok"

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-8 text-center">
      <h1 className="text-8xl font-bold tracking-tight text-amber-400">
        Don&apos;t Panic
      </h1>
      <p
        className={`font-mono text-xl ${ok ? "text-green-400" : "text-red-400"}`}
      >
        API: {health.status}
        {health.timestamp && (
          <span className="ml-4 text-sm text-zinc-500">{health.timestamp}</span>
        )}
      </p>
    </main>
  )
}
