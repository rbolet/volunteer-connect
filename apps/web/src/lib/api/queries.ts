import {
  myResponseViewSchema,
  signupDetailSchema,
  signupListItemSchema,
  signupTemplateListItemSchema,
  teamWithPointsSchema,
} from "@vc/zod"
import type {
  MyResponseView,
  ResolvedSession,
  SignupDetail,
  SignupListItem,
  SignupTemplateListItem,
  TeamWithPoints,
} from "@vc/types"
import { ApiError, apiGetJson } from "./client"

// Read-side BFF queries: every payload from Express is re-validated against
// the shared response schemas before it reaches a component, so a drift
// between the two apps fails loudly at the boundary instead of rendering
// garbage.

export async function getSignups(session: ResolvedSession): Promise<SignupListItem[]> {
  const body = await apiGetJson<{ signups: unknown }>("/signups", session)
  return signupListItemSchema.array().parse(body.signups)
}

export async function getSignupDetail(
  session: ResolvedSession,
  signupId: string
): Promise<SignupDetail | null> {
  try {
    const body = await apiGetJson<{ signup: unknown }>(
      `/signups/${encodeURIComponent(signupId)}`,
      session
    )
    return signupDetailSchema.parse(body.signup)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export async function getSignupTemplates(
  session: ResolvedSession
): Promise<SignupTemplateListItem[]> {
  const body = await apiGetJson<{ templates: unknown }>("/signup-templates", session)
  return signupTemplateListItemSchema.array().parse(body.templates)
}

export async function getTeams(session: ResolvedSession): Promise<TeamWithPoints[]> {
  const body = await apiGetJson<{ teams: unknown }>("/teams", session)
  return teamWithPointsSchema.array().parse(body.teams)
}

export async function getMyResponses(session: ResolvedSession): Promise<MyResponseView[]> {
  const body = await apiGetJson<{ responses: unknown }>("/me/responses", session)
  return myResponseViewSchema.array().parse(body.responses)
}
