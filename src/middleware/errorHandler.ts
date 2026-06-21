import { type Request, type Response, type NextFunction } from "express";
import { UpstreamApiError, QrSessionError } from "../utils/errors.js";
import { isProduction } from "../config/env.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof QrSessionError) {
    return res.status(400).json({ message: err.message });
  }

  if (err instanceof UpstreamApiError) {
    // Mirror the main backend's status where it makes sense to the
    // client (404/400/403/401); collapse anything else to a generic 502
    // since it represents an upstream failure, not a client mistake.
    const passthroughStatuses = [400, 401, 403, 404];
    const status = passthroughStatuses.includes(err.status) ? err.status : 502;
    return res.status(status).json({ message: err.message });
  }

  console.error("Unhandled error:", err);

  return res.status(500).json({
    message: "Internal server error",
    ...(isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Route not found" });
}
