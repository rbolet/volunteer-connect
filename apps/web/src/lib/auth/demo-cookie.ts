import { demoIdentitySchema } from "@vc/zod"
import type { DemoIdentity } from "@vc/types"

// Signed demo-identity cookie (AUTH.md → DemoSessionResolver). The cookie
// carries ONLY the identity enum — never a user id, never an org id; both are
// resolved server-side from the seeded demo org. HMAC via Web Crypto so the
// same code runs in Edge middleware and Node server actions.

export const DEMO_COOKIE = "demo_session"

const encoder = new TextEncoder()

async function hmacHex(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function signDemoIdentity(identity: DemoIdentity, secret: string): Promise<string> {
  return `${identity}.${await hmacHex(identity, secret)}`
}

/** Returns the identity if the cookie is present, well-formed, and correctly signed — else null. */
export async function verifyDemoCookie(
  value: string | undefined,
  secret: string
): Promise<DemoIdentity | null> {
  if (!value) return null
  const dot = value.indexOf(".")
  if (dot < 0) return null
  const identity = demoIdentitySchema.safeParse(value.slice(0, dot))
  if (!identity.success) return null
  const expected = await hmacHex(identity.data, secret)
  if (!timingSafeEqualHex(value.slice(dot + 1), expected)) return null
  return identity.data
}
