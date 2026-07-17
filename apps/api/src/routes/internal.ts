import { Router } from "express"
import { demoIdentitySchema } from "@vc/zod"
import type { Repos } from "../repositories"
import { asyncHandler } from "../lib/async-handler"

// BFF-secret-guarded, pre-session: this is where the web BFF's
// DemoSessionResolver obtains a ResolvedSession for a fixed demo identity.
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

  return router
}
