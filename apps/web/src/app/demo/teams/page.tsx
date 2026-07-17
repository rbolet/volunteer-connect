import { getTeams } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function TeamsPage() {
  const demo = await getDemoSession()
  if (!demo) return null

  const teams = await getTeams(demo.session)
  const ranked = [...teams].sort((a, b) => b.totalPoints - a.totalPoints)
  const myTeamIds = new Set(demo.session.team_roles.map((t) => t.team_id))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead className="w-24 text-right">Number</TableHead>
            <TableHead className="w-28">Color</TableHead>
            <TableHead className="w-28 text-right">Members</TableHead>
            <TableHead className="w-28 text-right">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranked.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">
                {t.name}
                {myTeamIds.has(t.id) && (
                  <span className="ml-2 text-xs text-muted-foreground">(my team)</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{t.teamNumber ?? "—"}</TableCell>
              <TableCell>{t.color ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{t.memberCount}</TableCell>
              <TableCell className="text-right text-lg font-semibold tabular-nums">
                {t.totalPoints}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Points are earned when an admin confirms a completed volunteer slot and always accrue to a
        team, not an individual.
      </p>
    </div>
  )
}
