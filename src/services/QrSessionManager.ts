import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import { QrSessionError } from "../utils/errors.js";
import { fetchTeacherSession, markAttendanceOnMainBackend } from "./mainBackendClient.js";
import type { ActiveQrSession, PublicQrSession } from "../types/qr.js";

interface InternalSession extends ActiveQrSession {
  interval: NodeJS.Timeout;
  timeout: NodeJS.Timeout;
}

function toPublic(session: InternalSession): PublicQrSession {
  const { interval, timeout, ...publicFields } = session;
  return publicFields;
}

async function buildQrImage(payload: { qrToken: string; token: string; sessionId: number }): Promise<string> {
  return QRCode.toDataURL(JSON.stringify(payload));
}

/**
 * Manages live QR attendance runs entirely in memory, keyed by the
 * main backend's Session.id. Multiple teachers/classes can run QR
 * attendance concurrently without interfering with each other.
 *
 * This class owns no persistence and no user identity — it only knows
 * how to rotate tokens and recognize a valid scan against the
 * currently displayed token. Identity and attendance writes are
 * delegated to the main backend.
 */
export class QrSessionManager {
  private sessions = new Map<number, InternalSession>();

  /**
   * Start a new QR run for a given session. Confirms with the main
   * backend (using the teacher's own JWT) that the session exists,
   * belongs to that teacher, and is open for attendance.
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
   * Verify a scan and, if valid, ask the main backend to record
   * attendance using the student's own forwarded JWT. The student's
   * identity is never known to this service beyond "owner of this
   * Authorization header" — the main backend resolves and authorizes it.
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

    if (session.qrToken !== qrToken || session.currentToken !== token) {
      throw new QrSessionError("This QR code has expired — please scan the current one");
    }

    // Delegate the actual write (and all of its checks: enrollment,
    // session-open, no-duplicate) to the main backend.
    return markAttendanceOnMainBackend(sessionId, studentAuthToken);
  }

  /**
   * Number of QR runs currently active. Exposed for health/debug endpoints.
   */
  get activeCount(): number {
    return this.sessions.size;
  }

  private async rotateToken(sessionId: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const newToken = randomUUID();
    const newImage = await buildQrImage({
      qrToken: session.qrToken,
      token: newToken,
      sessionId,
    });

    session.currentToken = newToken;
    session.qrImage = newImage;
  }
}

// Singleton — one in-memory store per running instance of this service.
export const qrSessionManager = new QrSessionManager();
