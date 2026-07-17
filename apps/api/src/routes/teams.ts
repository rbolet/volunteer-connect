import { Router } from "express"
import type { Repos } from "../repositories"
import { asyncHandler } from "../lib/async-handler"

export function teamsRouter(repos: Repos): Router {
  const router = Router()

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const teams = await repos.teams.listWithPoints(req.session!.org_id)
      res.json({ teams })
    })
  )

  return router
}
