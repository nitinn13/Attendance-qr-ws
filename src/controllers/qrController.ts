import type { Request, Response } from "express";
import { QRCodeService } from "../services/QRCodeService";
import * as qrServiceLegacy from "../services/QRCodeService"; // keep legacy exports

// New class instance
const qrService = new QRCodeService();

/* -------------------------------
   Legacy Controllers
--------------------------------- */

/**
 * Generate QR (legacy, Redis based)
 */
export async function generateQR(_req: Request, res: Response): Promise<void> {
  try {
    const { sessionId, qrImage } = await qrServiceLegacy.generateQRCode();
    res.json({ sessionId, qrImage });
  } catch (err) {
    console.error("Error in generateQR:", err);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
}

/**
 * Verify QR (legacy, Redis based)
 */
export async function verifyQR(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId" });
      return;
    }

    const result = await qrServiceLegacy.verifyQRCode(sessionId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (err) {
    console.error("Error in verifyQR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/* -------------------------------
   New Class-Based Controllers
--------------------------------- */

/**
 * Start QR session (teacher side)
 */
export const generateQr = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.body;  // CHANGED: expect classId
    if (!classId) {
      res.status(400).json({ error: "classId required" });
      return;
    }

    const session = await qrService.startSession(Number(classId));  // CHANGED: pass as number
    res.json(session);
  } catch (err) {
    console.error("Error in generateQr:", err);
    res.status(500).json({ error: "Failed to generate QR" });
  }
};

/**
 * 🛑 Stop session
 */
export const stopQr = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId required" });
      return;
    }
    await qrService.stopSession(sessionId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error in stopQr:", err);
    res.status(500).json({ error: "Failed to stop session" });
  }
};

/**
 *  Get currently active session
 */
export const getActiveSession = async (_: Request, res: Response): Promise<void> => {
  try {
    const session = qrService.getActiveSession();
    res.json(session);
  } catch (err) {
    console.error("Error in getActiveSession:", err);
    res.status(500).json({ error: "Failed to fetch active session" });
  }
};

/**
 * Verify QR scan (student side, with rotating token)
 */
export const verifyQr = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, token, studentId } = req.body;
    if (!sessionId || !token || !studentId) {
      res.status(400).json({ error: "sessionId, token, and studentId required" });
      return;
    }

    const result = await qrService.verifyAttendance(sessionId, token, studentId);
    res.json(result);
  } catch (err) {
    console.error("Error in verifyQr:", err);
    res.status(400).json({ error: "Invalid QR or session expired" });
  }
};
