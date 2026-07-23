"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { demoIdentitySchema } from "@vc/zod"
import { DEMO_COOKIE, signDemoIdentity } from "@/lib/auth/demo-cookie"

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
