"use server"

import { createSignupTemplateSchema, saveSignupAsTemplateSchema } from "@vc/zod"
import type { CreateSignupTemplateInput } from "@vc/types"
import { adminMutation, type ActionResult, type ActionResultWithId } from "@/lib/api/mutations"

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
