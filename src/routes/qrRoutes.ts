import { Router } from "express";
import { startQr, stopQr, getActiveQr, verifyQr } from "../controllers/qrController.js";
import { requireAuthHeader } from "../middleware/requireAuthHeader.js";
import { verifyRateLimiter, startRateLimiter } from "../middleware/rateLimiters.js";

const router = Router();

// Teacher starts a rotating QR for a specific session (class date).
router.post("/start", startRateLimiter, requireAuthHeader, startQr);

// Teacher stops a running QR early.
router.post("/stop", requireAuthHeader, stopQr);

// Student polls for the currently displayed QR image. No identity
// needed to view a QR code — just to scan/verify it — so this is
// intentionally not gated behind requireAuthHeader.
router.get("/active", getActiveQr);

// Student submits a scanned QR for verification + attendance marking.
router.post("/verify", verifyRateLimiter, requireAuthHeader, verifyQr);

export default router;
