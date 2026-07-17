import { Router } from "express"
import type { Repos } from "../repositories"
import { asyncHandler } from "../lib/async-handler"

export function meRouter(repos: Repos): Router {
  const router = Router()

  router.get(
    "/responses",
    asyncHandler(async (req, res) => {
      const session = req.session!
      const responses = await repos.slotResponses.listForUser(session.org_id, session.user_id)
      res.json({ responses })
    })
  )

  return router
}
