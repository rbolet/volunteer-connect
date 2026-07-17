import type { SignupStatus, SlotResponseStatus } from "@vc/types"
import { Badge } from "@/components/ui/badge"

const SIGNUP_STATUS: Record<
  SignupStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  draft: { label: "Draft", variant: "outline" },
  open: { label: "Open", variant: "default" },
  closed: { label: "Closed", variant: "secondary" },
  finalized: { label: "Finalized", variant: "secondary" },
}

export function SignupStatusBadge({ status }: { status: SignupStatus }) {
  const { label, variant } = SIGNUP_STATUS[status]
  return <Badge variant={variant}>{label}</Badge>
}

const RESPONSE_STATUS: Record<
  SlotResponseStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "Pending", variant: "outline" },
  assigned: { label: "Assigned", variant: "default" },
  declined: { label: "Declined", variant: "destructive" },
  completed: { label: "Completed", variant: "secondary" },
}

export function ResponseStatusBadge({ status }: { status: SlotResponseStatus }) {
  const { label, variant } = RESPONSE_STATUS[status]
  return <Badge variant={variant}>{label}</Badge>
}
