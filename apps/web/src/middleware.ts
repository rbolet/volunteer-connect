import { NextResponse, type NextRequest } from "next/server"
import { DEMO_COOKIE, signDemoIdentity, verifyDemoCookie } from "@/lib/auth/demo-cookie"

// The entire demo/prod boundary (AUTH.md): resolver choice is route-based,
// evaluated server-side — never a client-supplied flag. Edge constraints mean
// this middleware only gates + issues the signed identity cookie; full session
// resolution (DB-backed) happens in the Node layer (lib/auth/session-resolver).
export const config = {
  matcher: ["/demo", "/demo/:path*"],
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.DEMO_SESSION_SECRET
  if (!secret) {
    // Fail closed — an unsigned demo cookie must never be issued.
    return new NextResponse("Demo mode is not configured.", { status: 503 })
  }

  const existing = await verifyDemoCookie(req.cookies.get(DEMO_COOKIE)?.value, secret)

  const response =
    req.nextUrl.pathname === "/demo"
      ? NextResponse.redirect(new URL("/demo/dashboard", req.url))
      : NextResponse.next()

  // Missing or tampered cookie → issue a fresh one for the default identity.
  if (!existing) {
    response.cookies.set(DEMO_COOKIE, await signDemoIdentity("volunteer", secret), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    })
  }

  return response
}
