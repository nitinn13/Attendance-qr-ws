import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import { QrSessionError } from "../utils/errors.js";
import { fetchTeacherSession, markAttendanceOnMainBackend } from "./mainBackendClient.js";
import type { ActiveQrSession, PublicQrSession } from "../types/qr.js";

// Extend the InternalSession interface to retain the previous valid token
interface InternalSession extends ActiveQrSession {
  previousToken: string | null; // 👈 Holds the token from the immediately preceding 5s window
  interval: NodeJS.Timeout;
  timeout: NodeJS.Timeout;
}

function toPublic(session: InternalSession): PublicQrSession {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { interval, timeout, previousToken, ...publicFields } = session;
  return publicFields;
}

async function buildQrImage(payload: { qrToken: string; token: string; sessionId: number }): Promise<string> {
  return QRCode.toDataURL(JSON.stringify(payload));
}

/**
 * Manages live QR attendance runs entirely in memory with a sliding-window
 * grace period buffer to prevent edge-case race conditions for students.
 */
export class QrSessionManager {
  private sessions = new Map<number, InternalSession>();

  /**
   * Start a new QR run for a given session.
   */
  async startSession(sessionId: number, teacherAuthToken: string): Promise<PublicQrSession> {
    const remoteSession = await fetchTeacherSession(sessionId, teacherAuthToken);

    if (!remoteSession.isAttendanceOpen) {
      throw new QrSessionError(
        "Attendance is not open for this session. Open it from the teacher dashboard first."
      );
    }

    // Replace any existing run for this session rather than stacking timers.
    this.stopSession(sessionId);

    const qrToken = randomUUID();
    const token = randomUUID();
    const startedAt = Date.now();
    const expiresAt = startedAt + env.QR_SESSION_DURATION_MS;

    const qrImage = await buildQrImage({ qrToken, token, sessionId });

    const interval = setInterval(() => {
      void this.rotateToken(sessionId);
    }, env.QR_TOKEN_REFRESH_MS);

    const timeout = setTimeout(() => {
      this.stopSession(sessionId);
    }, env.QR_SESSION_DURATION_MS);

    const session: InternalSession = {
      qrToken,
      sessionId,
      classId: remoteSession.classId,
      className: remoteSession.className,
      currentToken: token,
      previousToken: null, // 👈 Starts as null since there is no preceding code yet
      qrImage,
      expiresAt,
      startedAt,
      interval,
      timeout,
    };

    this.sessions.set(sessionId, session);

    return toPublic(session);
  }

  /**
   * Stop a QR run. Safe to call even if no run is active.
   */
  stopSession(sessionId: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    clearInterval(session.interval);
    clearTimeout(session.timeout);
    this.sessions.delete(sessionId);
  }

  /**
   * Return the current QR state for a session, if a run is active and
   * not yet expired.
   */
  getActiveSession(sessionId: number): PublicQrSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.stopSession(sessionId);
      return null;
    }

    return toPublic(session);
  }

  /**
   * Verify a scan with sliding-window evaluation.
   */
  async verifyAndMarkAttendance(
    sessionId: number,
    qrToken: string,
    token: string,
    studentAuthToken: string
  ): Promise<{ message: string }> {
    const session = this.sessions.get(sessionId);

    if (!session || Date.now() > session.expiresAt) {
      throw new QrSessionError("No active QR session for this class");
    }

    // 1. Verify the static base session token matches
    if (session.qrToken !== qrToken) {
      throw new QrSessionError("This QR code belongs to an expired session context");
    }

    // 2. 👇 SLIDING WINDOW MATCH: Allow match if it targets current OR previous rolling token
    const isCurrentTokenValid = session.currentToken === token;
    const isPreviousTokenValid = session.previousToken !== null && session.previousToken === token;

    if (!isCurrentTokenValid && !isPreviousTokenValid) {
      throw new QrSessionError("This QR code has expired — please scan the current one");
    }

    // Delegate the actual write to the main backend.
    return markAttendanceOnMainBackend(sessionId, studentAuthToken);
  }

  /**
   * Number of QR runs currently active. Exposed for health/debug endpoints.
   */
  get activeCount(): number {
    return this.sessions.size;
  }

  /**
   * Rotates tokens smoothly every 5 seconds, sliding the old one into grace period buffer.
   */
  private async rotateToken(sessionId: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const newToken = randomUUID();
    const newImage = await buildQrImage({
      qrToken: session.qrToken,
      token: newToken,
      sessionId,
    });

    // 👇 Slide current token back into the previous token slot
    session.previousToken = session.currentToken;
    // Set the brand new token as active
    session.currentToken = newToken;
    session.qrImage = newImage;
  }
}

// Singleton — one in-memory store per running instance of this service.
export const qrSessionManager = new QrSessionManager();