"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import {
  createSignupSchema,
  createSignupTemplateSchema,
  demoIdentitySchema,
  saveSignupAsTemplateSchema,
  signupSlotSchema,
  signupStatusChangeSchema,
} from "@vc/zod"
import type {
  CreateSignupInput,
  CreateSignupTemplateInput,
  SignupSlotInput,
  SignupStatusChangeInput,
} from "@vc/types"
import { ApiError, apiFetch } from "@/lib/api/client"
import { DEMO_COOKIE, signDemoIdentity } from "@/lib/auth/demo-cookie"
import { getDemoSession } from "@/lib/auth/session-resolver"

export type ActionResult = { ok: true } | { ok: false; error: string }
export type ActionResultWithId = { ok: true; id: string } | { ok: false; error: string }

// "View as" switcher (DEMO_MODE.md): re-issues the signed cookie for another
// fixed, enum-validated identity. Never a free-form user id.
export async function switchIdentity(formData: FormData): Promise<void> {
  const identity = demoIdentitySchema.parse(formData.get("identity"))
  const secret = process.env.DEMO_SESSION_SECRET
  if (!secret) throw new Error("DEMO_SESSION_SECRET is not set")
  const store = await cookies()
  store.set(DEMO_COOKIE, await signDemoIdentity(identity, secret), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })
  revalidatePath("/demo", "layout")
}

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

async function adminMutation(
  path: string,
  init: { method: string; body?: unknown }
): Promise<{ ok: true; response: Response } | { ok: false; error: string }> {
  const demo = await getDemoSession()
  if (!demo) return { ok: false, error: "no_session" }
  try {
    const response = await apiFetch(path, {
      method: init.method,
      session: demo.session,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    revalidatePath("/demo", "layout")
    return { ok: true, response }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.code }
    throw err
  }
}

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

// --- Signup templates --------------------------------------------------

export async function createSignupTemplate(
  input: CreateSignupTemplateInput
): Promise<ActionResultWithId> {
  const parsed = createSignupTemplateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const result = await adminMutation("/signup-templates", { method: "POST", body: parsed.data })
  if (!result.ok) return result
  const { id } = (await result.response.json()) as { id: string }
  return { ok: true, id }
}

export async function saveSignupAsTemplate(
  signupId: string,
  title: string
): Promise<ActionResultWithId> {
  const parsed = saveSignupAsTemplateSchema.safeParse({ title })
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const result = await adminMutation(`/signups/${encodeURIComponent(signupId)}/save-as-template`, {
    method: "POST",
    body: parsed.data,
  })
  if (!result.ok) return result
  const { id } = (await result.response.json()) as { id: string }
  return { ok: true, id }
}

export async function deleteSignupTemplate(templateId: string): Promise<ActionResult> {
  const result = await adminMutation(`/signup-templates/${encodeURIComponent(templateId)}`, {
    method: "DELETE",
  })
  return result.ok ? { ok: true } : result
}
