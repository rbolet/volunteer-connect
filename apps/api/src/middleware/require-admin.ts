import type { NextFunction, Request, Response } from "express"

// Gate for admin mutations (permission matrix, DATA_MODEL.md). Runs after
// requireSession, so req.session is present on any request that reaches it.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.org_roles.includes("admin")) {
    res.status(403).json({ error: "admin_only" })
    return
  }
  next()
}
