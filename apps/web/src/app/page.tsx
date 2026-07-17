import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Volunteer Connect</h1>
      <p className="max-w-md text-balance text-muted-foreground">
        Volunteer signups and team points for AYSO regions — the sign-up sheet without the
        clipboard.
      </p>
      <Button asChild size="lg">
        <Link href="/demo">View the live demo</Link>
      </Button>
    </main>
  )
}
