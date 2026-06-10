import QRCode from "qrcode";
import crypto from "crypto";
import { redisClient } from "../config/redisClient";
import { v4 as uuidv4 } from "uuid";

/* -------------------------------
   Legacy Interfaces + Functions
--------------------------------- */
interface QRSession {
  eventId: string;
  createdAt: number;
}

interface GenerateQRResponse {
  qrImage: string;
  sessionId: string;
  createdAt: number;
}

interface VerifyQRResponse {
  success: boolean;
  error?: string;
  message?: string;
  sessionId?: string;
  eventId?: string;
}

/**
 * Legacy: Generate QR using Redis
 */
export async function generateQRCode(): Promise<GenerateQRResponse> {
  try {
    // Delete any previous active QR session
    const current = await redisClient.get("qr:current");
    if (current) {
      const { sessionId } = JSON.parse(current) as { sessionId: string };
      await redisClient.del(`qr:session:${sessionId}`);
      await redisClient.del("qr:current");
    }

    // Create a new QR session
    const sessionId = crypto.randomUUID();
    const createdAt = Math.floor(Date.now() / 1000);

    // Store session in Redis (30s expiry)
    const sessionData: QRSession = { eventId: "attend2025", createdAt };
    await redisClient.set(`qr:session:${sessionId}`, JSON.stringify(sessionData), { EX: 30 });

    // Mark as the current QR
    await redisClient.set("qr:current", JSON.stringify({ sessionId, createdAt }), { EX: 30 });

    // Generate QR Code image
    const qrImage = await QRCode.toDataURL(JSON.stringify({ sessionId }));

    return { qrImage, sessionId, createdAt };
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
}

/**
 *Legacy: Verify QR using Redis
 */
export async function verifyQRCode(sessionId: string): Promise<VerifyQRResponse> {
  try {
    const current = await redisClient.get("qr:current");
    if (!current) {
      return { success: false, error: "No active QR" };
    }

    const { sessionId: activeSessionId, createdAt } = JSON.parse(current) as {
      sessionId: string;
      createdAt: number;
    };

    if (sessionId !== activeSessionId) {
      return { success: false, error: "QR already rolled out (expired)" };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - createdAt >= 30) {
      return { success: false, error: "QR expired" };
    }

    return {
      success: true,
      message: "Attendance marked successfully",
      sessionId,
      eventId: "attend2025",
    };
  } catch (error) {
    console.error("Error verifying QR code:", error);
    return { success: false, error: "Internal server error" };
  }
}

/* -------------------------------
   New Class-Based Session Service
--------------------------------- */
interface ActiveSession {
  sessionId: string;       // 30s master session
  classId: number;         // CHANGED: from subjectCode to classId
  currentToken: string;    // refreshed every 5s
  qrData: string;          // encodes {sessionId, token, classId}
  expiresAt: number;       // absolute expiry
}

export class QRCodeService {
  private activeSession: ActiveSession | null = null;
  private interval: NodeJS.Timeout | null = null;

  /**
   * Start a new QR session for a class
   */
  async startSession(classId: number): Promise<ActiveSession> {
    const sessionId = uuidv4();
    const expiresAt = Date.now() + 30_000; // 30s expiry

    // First token
    const token = uuidv4();
    const qrData = await this.generateQrCode({ sessionId, token, classId });

    this.activeSession = {
      sessionId,
      classId,
      currentToken: token,
      qrData,
      expiresAt,
    };

    // Refresh QR every 5 seconds with a new token
    this.interval && clearInterval(this.interval);
    this.interval = setInterval(async () => {
      if (!this.activeSession) return;
      const newToken = uuidv4();
      this.activeSession.currentToken = newToken;
      this.activeSession.qrData = await this.generateQrCode({
        sessionId: this.activeSession.sessionId,
        token: newToken,
        classId: this.activeSession.classId,
      });
    }, 5000);

    // Stop after 30s
    setTimeout(() => this.stopSession(sessionId), 30_000);

    return this.activeSession;
  }

  /**
   * Stop session manually
   */
  async stopSession(sessionId: string) {
    if (this.activeSession?.sessionId === sessionId) {
      this.activeSession = null;
    }
    this.interval && clearInterval(this.interval);
    this.interval = null;
  }

  /**
   * Get the current session (if still valid)
   */
  getActiveSession() {
    if (!this.activeSession) return null;
    if (Date.now() > this.activeSession.expiresAt) {
      this.stopSession(this.activeSession.sessionId);
      return null;
    }
    return this.activeSession;
  }

  /**
   * Verify student scan
   * Requires both sessionId + token to match
   */
  async verifyAttendance(sessionId: string, token: string, studentId: string) {
    if (
      !this.activeSession ||
      this.activeSession.sessionId !== sessionId ||
      this.activeSession.currentToken !== token
    ) {
      throw new Error("Invalid or expired QR");
    }

    // Example DB save
    return {
      success: true,
      studentId,
      sessionId,
      timestamp: new Date(),
    };
  }

  /**
   * Generate QR image from payload
   */
  private async generateQrCode(payload: { sessionId: string; token: string; classId: number }) {
    return await QRCode.toDataURL(JSON.stringify(payload));
  }
}