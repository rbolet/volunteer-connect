import { Router } from "express"
import type { Repos } from "../repositories"
import type { WithdrawRejection } from "../lib/claim-rules"
import { asyncHandler } from "../lib/async-handler"

// `not_owner` deliberately maps to 404, not 403 — confirming that a response
// id exists but belongs to someone else leaks information for no benefit.
const WITHDRAW_STATUS: Record<WithdrawRejection, number> = {
  not_found: 404,
  not_owner: 404,
  signup_not_open: 409,
  not_pending: 409,
}

export function slotResponsesRouter(repos: Repos): Router {
  const router = Router()

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const result = await repos.slotResponses.withdraw({
        session: req.session!,
        responseId: req.params.id,
      })
      if (!result.ok) {
        res.status(WITHDRAW_STATUS[result.reason]).json({ error: result.reason })
        return
      }
      res.status(204).end()
    })
  )

  return router
}
