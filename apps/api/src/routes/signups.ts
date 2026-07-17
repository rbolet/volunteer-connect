import { Router } from "express"
import { createSignupSchema, signupSlotSchema, signupStatusChangeSchema } from "@vc/zod"
import type { ResolvedSession, SignupDetail } from "@vc/types"
import type { Repos } from "../repositories"
import { asyncHandler } from "../lib/async-handler"
import { requireAdmin } from "../middleware/require-admin"

function isAdmin(session: ResolvedSession): boolean {
  return session.org_roles.includes("admin")
}

// Permission matrix (DATA_MODEL.md): while a signup is open/closed,
// volunteers see their own responses only — admins (or anyone once
// finalized) see the full roster. claimedCount stays intact either way so
// slot fullness is still renderable.
function redactResponses(detail: SignupDetail, session: ResolvedSession): SignupDetail {
  if (isAdmin(session) || detail.status === "finalized") return detail
  return {
    ...detail,
    slots: detail.slots.map((slot) => ({
      ...slot,
      responses: slot.responses.filter((r) => r.userId === session.user_id),
    })),
  }
}

export function signupsRouter(repos: Repos): Router {
  const router = Router()

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const session = req.session!
      const signups = await repos.signups.listForOrg(session.org_id, {
        includeDrafts: isAdmin(session),
      })
      res.json({ signups })
    })
  )

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const session = req.session!
      const detail = await repos.signups.getDetail(session.org_id, req.params.id)
      // Drafts are invisible to non-admins (not merely redacted).
      if (!detail || (detail.status === "draft" && !isAdmin(session))) {
        res.status(404).json({ error: "not_found" })
        return
      }
      res.json({ signup: redactResponses(detail, session) })
    })
  )

  // --- Admin mutations (permission matrix: create/edit signup, finalize) ---

  router.post(
    "/",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const body = createSignupSchema.safeParse(req.body)
      if (!body.success) {
        res.status(400).json({ error: "invalid_body" })
        return
      }
      const session = req.session!
      const result = await repos.signups.create({
        orgId: session.org_id,
        adminId: session.user_id,
        input: body.data,
      })
      if (!result.ok) {
        res.status(409).json({ error: result.reason })
        return
      }
      res.status(201).json({ id: result.id })
    })
  )

  router.patch(
    "/:id/status",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const body = signupStatusChangeSchema.safeParse(req.body)
      if (!body.success) {
        res.status(400).json({ error: "invalid_body" })
        return
      }
      const result = await repos.signups.changeStatus({
        session: req.session!,
        signupId: req.params.id,
        target: body.data.status,
      })
      if (!result.ok) {
        res.status(result.reason === "not_found" ? 404 : 409).json({ error: result.reason })
        return
      }
      res.json({ ok: true })
    })
  )

  router.post(
    "/:id/slots",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const body = signupSlotSchema.safeParse(req.body)
      if (!body.success) {
        res.status(400).json({ error: "invalid_body" })
        return
      }
      const result = await repos.slots.add({
        session: req.session!,
        signupId: req.params.id,
        input: body.data,
      })
      if (!result.ok) {
        res.status(result.reason === "not_found" ? 404 : 409).json({ error: result.reason })
        return
      }
      res.status(201).json({ id: result.id })
    })
  )

  return router
}
