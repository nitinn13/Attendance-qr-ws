import { type Request, type Response } from "express";
import { qrSessionManager } from "../services/QrSessionManager.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { startQrSchema, stopQrSchema, verifyQrSchema, activeSessionQuerySchema } from "../types/validation.js";

/**
 * POST /qr/start
 * Body: { sessionId: number }
 * Auth: teacher's Bearer token, forwarded to the main backend to
 * confirm ownership and that the session is open.
 */
export const startQr = asyncHandler(async (req: Request, res: Response) => {
  const result = startQrSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: "Invalid input", details: result.error.format() });
  }

  const session = await qrSessionManager.startSession(result.data.sessionId, req.authToken!);
  return res.status(200).json(session);
});

/**
 * POST /qr/stop
 * Body: { sessionId: number }
 *
 * Stopping is idempotent and local-only — no main backend call needed,
 * since this only tears down in-memory token rotation. Anyone holding
 * a valid Bearer token can stop a run; if you want this restricted to
 * the owning teacher specifically, that check belongs on /qr/start's
 * sibling once teacher-class ownership is exposed read-side.
 */
export const stopQr = asyncHandler(async (req: Request, res: Response) => {
  const result = stopQrSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: "Invalid input", details: result.error.format() });
  }

  qrSessionManager.stopSession(result.data.sessionId);
  return res.status(200).json({ success: true });
});

/**
 * GET /qr/active?sessionId=123
 * Polled by students to fetch the currently displayed QR image.
 */
export const getActiveQr = asyncHandler(async (req: Request, res: Response) => {
  const result = activeSessionQuerySchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ message: "Invalid input", details: result.error.format() });
  }

  const session = qrSessionManager.getActiveSession(result.data.sessionId);

  if (!session) {
    return res.status(404).json({ message: "No active QR session" });
  }

  return res.status(200).json(session);
});

/**
 * POST /qr/verify
 * Body: { sessionId, qrToken, token }
 * Auth: student's Bearer token, forwarded to the main backend's
 * mark-attendance endpoint, which owns enrollment/duplicate/open checks.
 */
export const verifyQr = asyncHandler(async (req: Request, res: Response) => {
  const result = verifyQrSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: "Invalid input", details: result.error.format() });
  }

  const { sessionId, qrToken, token } = result.data;

  const outcome = await qrSessionManager.verifyAndMarkAttendance(
    sessionId,
    qrToken,
    token,
    req.authToken!
  );

  return res.status(200).json({ success: true, ...outcome });
});
