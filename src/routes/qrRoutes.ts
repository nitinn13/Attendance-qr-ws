import { Router } from "express";
import {
  generateQR,   // legacy (Redis-based)
  verifyQR,     // legacy (Redis-based)
  generateQr,   // new (with rotating token)
  stopQr,
  getActiveSession,
  verifyQr
} from "../controllers/qrController";

const router = Router();

/* -------------------------------
Legacy Endpoints (keep alive for compatibility)
--------------------------------- */
router.post("/generateQR", generateQR);   // POST /api/qr/generateQR
router.post("/verifyQR", verifyQR);       // POST /api/qr/verifyQR

/* -------------------------------
New Endpoints (token-based QR sessions)
--------------------------------- */
router.post("/start", generateQr);        // POST /api/qr/start  -> teacher starts session
router.post("/stop", stopQr);             // POST /api/qr/stop   -> teacher stops session
router.get("/active", getActiveSession);  // GET  /api/qr/active -> student polls active QR
router.post("/verify", verifyQr);         // POST /api/qr/verify -> student verifies scan

export default router;