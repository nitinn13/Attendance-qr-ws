import { type Request, type Response, type NextFunction } from "express";

/**
 * This service does not authenticate users itself — it has no JWT
 * secret and no user database. It only requires that a Bearer token
 * was sent, and stashes it on req.authToken so the controller can
 * forward it untouched to the main backend, which is the sole source
 * of truth for identity and authorization.
 */
export function requireAuthHeader(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or malformed Authorization header" });
  }

  req.authToken = header;
  return next();
}
