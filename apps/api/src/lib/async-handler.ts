import type { NextFunction, Request, RequestHandler, Response } from "express"

// Express 4 doesn't forward rejected promises to the error middleware —
// every async route is wrapped so a thrown error becomes a 500 instead of an
// unhandled rejection.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
