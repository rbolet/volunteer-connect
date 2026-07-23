"use server"

import { revalidatePath } from "next/cache"
import { createSignupSchema, signupSlotSchema, signupStatusChangeSchema } from "@vc/zod"
import type { CreateSignupInput, SignupSlotInput, SignupStatusChangeInput } from "@vc/types"
import { ApiError, apiFetch } from "@/lib/api/client"
import { adminMutation, type ActionResult, type ActionResultWithId } from "@/lib/api/mutations"
import { getDemoSession } from "@/lib/auth/session-resolver"

export async function claimSlot(slotId: string, teamId: string): Promise<ActionResult> {
  const demo = await getDemoSession()
  if (!demo) return { ok: false, error: "no_session" }
  try {
    await apiFetch(`/slots/${encodeURIComponent(slotId)}/responses`, {
      method: "POST",
      session: demo.session,
      body: JSON.stringify({ teamId }),
    })
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.code }
    throw err
  }
  revalidatePath("/demo", "layout")
  return { ok: true }
}

export async function withdrawResponse(responseId: string): Promise<ActionResult> {
  const demo = await getDemoSession()
  if (!demo) return { ok: false, error: "no_session" }
  try {
    await apiFetch(`/slot-responses/${encodeURIComponent(responseId)}`, {
      method: "DELETE",
      session: demo.session,
    })
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.code }
    throw err
  }
  revalidatePath("/demo", "layout")
  return { ok: true }
}

// --- Admin actions (Express re-checks the admin role; these are the demo
// admin's create/lifecycle/slot-editing surface) ---

export async function createSignup(input: CreateSignupInput): Promise<ActionResultWithId> {
  const parsed = createSignupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const result = await adminMutation("/signups", { method: "POST", body: parsed.data })
  if (!result.ok) return result
  const { id } = (await result.response.json()) as { id: string }
  return { ok: true, id }
}

export async function changeSignupStatus(
  signupId: string,
  status: SignupStatusChangeInput["status"]
): Promise<ActionResult> {
  const parsed = signupStatusChangeSchema.safeParse({ status })
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const result = await adminMutation(`/signups/${encodeURIComponent(signupId)}/status`, {
    method: "PATCH",
    body: parsed.data,
  })
  return result.ok ? { ok: true } : result
}

export async function addSlot(signupId: string, input: SignupSlotInput): Promise<ActionResult> {
  const parsed = signupSlotSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const result = await adminMutation(`/signups/${encodeURIComponent(signupId)}/slots`, {
    method: "POST",
    body: parsed.data,
  })
  return result.ok ? { ok: true } : result
}

export async function updateSlot(slotId: string, input: SignupSlotInput): Promise<ActionResult> {
  const parsed = signupSlotSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const result = await adminMutation(`/slots/${encodeURIComponent(slotId)}`, {
    method: "PATCH",
    body: parsed.data,
  })
  return result.ok ? { ok: true } : result
}

export async function deleteSlot(slotId: string): Promise<ActionResult> {
  const result = await adminMutation(`/slots/${encodeURIComponent(slotId)}`, { method: "DELETE" })
  return result.ok ? { ok: true } : result
}
