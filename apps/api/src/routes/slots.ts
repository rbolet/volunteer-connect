import { Router } from "express"
import { signupSlotSchema, slotClaimSchema } from "@vc/zod"
import type { Repos } from "../repositories"
import type { ClaimRejection } from "../lib/claim-rules"
import { asyncHandler } from "../lib/async-handler"
import { requireAdmin } from "../middleware/require-admin"

const CLAIM_STATUS: Record<ClaimRejection, number> = {
  slot_not_found: 404,
  wrong_mode: 409,
  signup_not_open: 409,
  not_eligible: 403,
  not_your_team: 403,
  already_claimed: 409,
  slot_full: 409,
}

export function slotsRouter(repos: Repos): Router {
  const router = Router()

  router.post(
    "/:slotId/responses",
    asyncHandler(async (req, res) => {
      const body = slotClaimSchema.safeParse(req.body)
      if (!body.success) {
        res.status(400).json({ error: "invalid_body" })
        return
      }
      const result = await repos.slotResponses.claim({
        session: req.session!,
        slotId: req.params.slotId,
        teamId: body.data.teamId,
      })
      if (!result.ok) {
        res.status(CLAIM_STATUS[result.reason]).json({ error: result.reason })
        return
      }
      res.status(201).json({ id: result.responseId })
    })
  )

  // --- Admin slot editing (draft/open signups; guarded against stranding claims) ---

  router.patch(
    "/:slotId",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const body = signupSlotSchema.safeParse(req.body)
      if (!body.success) {
        res.status(400).json({ error: "invalid_body" })
        return
      }
      const result = await repos.slots.update({
        session: req.session!,
        slotId: req.params.slotId,
        input: body.data,
      })
      if (!result.ok) {
        res.status(result.reason === "not_found" ? 404 : 409).json({ error: result.reason })
        return
      }
      res.json({ ok: true })
    })
  )

  router.delete(
    "/:slotId",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await repos.slots.remove({
        session: req.session!,
        slotId: req.params.slotId,
      })
      if (!result.ok) {
        res.status(result.reason === "not_found" ? 404 : 409).json({ error: result.reason })
        return
      }
      res.status(204).end()
    })
  )

  return router
}
