import Link from "next/link"
import { notFound } from "next/navigation"
import { getSignupDetail, getTeams } from "@/lib/api/queries"
import { getDemoSession } from "@/lib/auth/session-resolver"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/utils/format"
import { SignupStatusBadge } from "../../_components/status-badge"
import { AdminStatusControls, type AwardSummary } from "./_components/admin-status-controls"
import { ClaimCell } from "./_components/claim-cell"
import { SaveAsTemplateButton } from "./_components/save-as-template-button"
import { SlotEditor } from "./_components/slot-editor"

const ROLE_LABELS: Record<string, string> = {
  head_coach: "Head Coach",
  coach: "Coach",
  referee: "Referee",
  volunteer: "Volunteer",
}

export default async function SignupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const demo = await getDemoSession()
  if (!demo) return null

  const [signup, teams] = await Promise.all([
    getSignupDetail(demo.session, id),
    getTeams(demo.session),
  ])
  if (!signup) notFound()

  const session = demo.session
  const eligible = session.team_roles.some((t) => signup.eligibleRoles.includes(t.role))
  const myTeamIds = new Set(session.team_roles.map((t) => t.team_id))
  const myTeams = teams.filter((t) => myTeamIds.has(t.id)).map((t) => ({ id: t.id, name: t.name }))
  const isOpen = signup.status === "open"
  const isAdmin = session.org_roles.includes("admin")

  // What finalizing would award right now (admins see unredacted responses,
  // so this sums every non-declined response's slot points, grouped by team).
  const pointsByTeam = new Map<string, number>()
  for (const slot of signup.slots) {
    for (const r of slot.responses) {
      if (r.status === "declined") continue
      pointsByTeam.set(r.teamName, (pointsByTeam.get(r.teamName) ?? 0) + slot.pointValue)
    }
  }
  const awardSummary: AwardSummary = {
    total: [...pointsByTeam.values()].reduce((sum, p) => sum + p, 0),
    perTeam: [...pointsByTeam.entries()].map(([teamName, points]) => ({ teamName, points })),
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/demo/signups"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← All signups
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{signup.title}</h1>
          <SignupStatusBadge status={signup.status} />
        </div>
        {signup.eventName && (
          <p className="mt-1 text-sm text-muted-foreground">{signup.eventName}</p>
        )}
        {signup.description && <p className="mt-3 max-w-2xl text-sm">{signup.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {isOpen && signup.closesAt && <span>Closes {formatDate(signup.closesAt)} ·</span>}
          <span>
            {signup.claimedSeats}/{signup.totalSeats} seats claimed · open to
          </span>
          {signup.eligibleRoles.map((role) => (
            <Badge key={role} variant="outline">
              {ROLE_LABELS[role] ?? role}
            </Badge>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-start gap-3">
          <AdminStatusControls
            signupId={signup.id}
            status={signup.status}
            awardSummary={awardSummary}
          />
          <SaveAsTemplateButton signupId={signup.id} signupTitle={signup.title} />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slot</TableHead>
            <TableHead className="w-20 text-right">Points</TableHead>
            <TableHead className="w-24 text-right">Seats</TableHead>
            <TableHead>Who</TableHead>
            <TableHead className="w-44 text-right" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {signup.slots.map((slot) => {
            const mine = slot.responses.find((r) => r.userId === session.user_id) ?? null
            return (
              <TableRow key={slot.id}>
                <TableCell className="font-medium">{slot.label}</TableCell>
                <TableCell className="text-right tabular-nums">{slot.pointValue}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {slot.claimedCount}/{slot.capacity}
                </TableCell>
                <TableCell>
                  {slot.responses.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      {slot.claimedCount > 0 ? `${slot.claimedCount} claimed` : "—"}
                    </span>
                  ) : (
                    <span className="text-sm">
                      {slot.responses.map((r) => `${r.userName} (${r.teamName})`).join(", ")}
                      {/* Others' names are redacted while open — show the remainder as a count. */}
                      {slot.claimedCount > slot.responses.length &&
                        `, +${slot.claimedCount - slot.responses.length} more`}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <ClaimCell
                    key={session.user_id}
                    slotId={slot.id}
                    signupOpen={isOpen}
                    eligible={eligible}
                    seatsLeft={slot.capacity - slot.claimedCount}
                    myResponse={mine ? { id: mine.id, status: mine.status } : null}
                    myTeams={myTeams}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {isAdmin && (signup.status === "draft" || signup.status === "open") && (
        <SlotEditor
          signupId={signup.id}
          slots={signup.slots.map((slot) => ({
            id: slot.id,
            label: slot.label,
            pointValue: slot.pointValue,
            capacity: slot.capacity,
            claimedCount: slot.claimedCount,
          }))}
        />
      )}
    </div>
  )
}
