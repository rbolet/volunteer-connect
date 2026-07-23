import { revalidatePath } from "next/cache"
import { ApiError, apiFetch } from "./client"
import { getDemoSession } from "@/lib/auth/session-resolver"

export type ActionResult = { ok: true } | { ok: false; error: string }
export type ActionResultWithId = { ok: true; id: string } | { ok: false; error: string }

// Shared by every admin-authenticated server action (signups, signup-templates):
// resolves the session, sends the write to Express, and revalidates the app
// shell on success.
export async function adminMutation(
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
