import { Router } from "express"
import { createSignupTemplateSchema } from "@vc/zod"
import type { Repos } from "../repositories"
import { asyncHandler } from "../lib/async-handler"
import { requireAdmin } from "../middleware/require-admin"

// Templates are an admin-only authoring tool (same as signup creation) — no
// volunteer-facing routes here. "Save as template" for an existing signup
// lives on the signups router (POST /signups/:id/save-as-template), since it
// acts on a signup rather than this resource.
export function signupTemplatesRouter(repos: Repos): Router {
  const router = Router()

  router.get(
    "/",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const templates = await repos.signupTemplates.listForOrg(req.session!.org_id)
      res.json({ templates })
    })
  )

  router.post(
    "/",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const body = createSignupTemplateSchema.safeParse(req.body)
      if (!body.success) {
        res.status(400).json({ error: "invalid_body" })
        return
      }
      const session = req.session!
      const result = await repos.signupTemplates.create({
        orgId: session.org_id,
        adminId: session.user_id,
        input: body.data,
      })
      res.status(201).json({ id: result.id })
    })
  )

  router.delete(
    "/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await repos.signupTemplates.remove({
        orgId: req.session!.org_id,
        templateId: req.params.id,
      })
      if (!result.ok) {
        res.status(404).json({ error: result.reason })
        return
      }
      res.json({ ok: true })
    })
  )

  return router
}
