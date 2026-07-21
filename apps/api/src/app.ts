import express, { type Application, type NextFunction, type Request, type Response } from "express"
import { logger } from "@vc/logger"
import type { Repos } from "./repositories"
import { requireBffSecret, requireSession } from "./middleware/bff-auth"
import { internalRouter } from "./routes/internal"
import { meRouter } from "./routes/me"
import { signupsRouter } from "./routes/signups"
import { signupTemplatesRouter } from "./routes/signup-templates"
import { slotResponsesRouter } from "./routes/slot-responses"
import { slotsRouter } from "./routes/slots"
import { teamsRouter } from "./routes/teams"

export function createApp(repos: Repos): Application {
  const app = express()

  app.use(express.json())

  // Unauthenticated: platform health checks hit this directly.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() })
  })

  // Everything below requires the trusted BFF secret…
  app.use(requireBffSecret)
  app.use("/internal", internalRouter(repos))

  // …and everything below that additionally requires a resolved session.
  app.use(requireSession)
  app.use("/signups", signupsRouter(repos))
  app.use("/signup-templates", signupTemplatesRouter(repos))
  app.use("/slots", slotsRouter(repos))
  app.use("/slot-responses", slotResponsesRouter(repos))
  app.use("/teams", teamsRouter(repos))
  app.use("/me", meRouter(repos))

  // The unused 4th parameter is required — Express only treats 4-arity
  // middleware as an error handler.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("unhandled route error", {
      message: err instanceof Error ? err.message : String(err),
    })
    res.status(500).json({ error: "internal_error" })
  })

  return app
}
