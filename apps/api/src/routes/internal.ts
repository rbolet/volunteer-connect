import { Router } from "express"
import { demoIdentitySchema, inviteRedeemInputSchema } from "@vc/zod"
import type { Repos } from "../repositories"
import { asyncHandler } from "../lib/async-handler"

// Maps a repo's rejection reason to its HTTP status. Shared by both invite
// endpoints — validate() and redeem() report the same reason set (plus
// redeem()'s extra email_mismatch).
const INVITE_REASON_STATUS: Record<string, number> = {
  not_found: 404,
  expired: 410,
  redeemed: 409,
  email_mismatch: 400,
}

// BFF-secret-guarded, pre-session: this is where the web BFF's
// DemoSessionResolver/SupabaseSessionResolver obtain a ResolvedSession, and
// where sign-up redeems an org invite. All three run before a ResolvedSession
// exists to validate, hence the BFF-secret-only gate (see app.ts).
export function internalRouter(repos: Repos): Router {
  const router = Router()

  router.get(
    "/demo-session",
    asyncHandler(async (req, res) => {
      const identity = demoIdentitySchema.safeParse(req.query.identity)
      if (!identity.success) {
        res.status(400).json({ error: "invalid_identity" })
        return
      }
      const result = await repos.demoSession.resolve(identity.data)
      if (!result) {
        // Org or seeded users missing — the demo hasn't been seeded (yet).
        res.status(503).json({ error: "demo_not_seeded" })
        return
      }
      res.json(result)
    })
  )

  router.get(
    "/user-session",
    asyncHandler(async (req, res) => {
      const authId = req.query.auth_id
      if (typeof authId !== "string" || !authId) {
        res.status(400).json({ error: "invalid_auth_id" })
        return
      }
      const result = await repos.userSession.resolve(authId)
      if (!result) {
        // No User row yet — the "needs org" signal (REAL_AUTH_IMPLEMENTATION.md
        // Phase 2), not an error.
        res.status(404).json({ error: "user_not_found" })
        return
      }
      res.json(result)
    })
  )

  router.get(
    "/invites/:token/validate",
    asyncHandler(async (req, res) => {
      const result = await repos.orgInvites.validate(req.params.token)
      if (!result.ok) {
        res.status(INVITE_REASON_STATUS[result.reason]).json({ error: result.reason })
        return
      }
      res.json({ org_id: result.org_id, org_name: result.org_name })
    })
  )

  router.post(
    "/invites/redeem",
    asyncHandler(async (req, res) => {
      const parsed = inviteRedeemInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_input" })
        return
      }
      const { token, ...input } = parsed.data
      const result = await repos.orgInvites.redeem(token, input)
      if (!result.ok) {
        res.status(INVITE_REASON_STATUS[result.reason]).json({ error: result.reason })
        return
      }
      res.json({ userId: result.userId })
    })
  )

  return router
}
