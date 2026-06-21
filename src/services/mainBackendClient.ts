import { env } from "../config/env.js";
import { UpstreamApiError } from "../utils/errors.js";
import type { MainBackendSession } from "../types/qr.js";

/**
 * Thin client over the main backend's HTTP API.
 *
 * This service holds no JWT secret and no user database. Every call
 * here forwards the *caller's own* Authorization header through
 * untouched — the main backend remains the single source of truth for
 * who the user is and what they're allowed to do. We never decode or
 * inspect the token ourselves.
 */

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body && typeof (body as any).message === "string") {
    return (body as any).message;
  }
  return fallback;
}

/**
 * GET /teacher/session/:id on the main backend.
 * Used to confirm a session exists, belongs to the calling teacher,
 * and is currently open for attendance — before a QR run is started.
 */
export async function fetchTeacherSession(
  sessionId: number,
  authToken: string
): Promise<MainBackendSession> {
  const res = await fetch(`${env.MAIN_API_URL}/teacher/session/${sessionId}`, {
    method: "GET",
    headers: {
      Authorization: authToken,
    },
  });

  const body = await parseJsonSafe(res);

  if (!res.ok) {
    throw new UpstreamApiError(messageFrom(body, "Failed to fetch session"), res.status, body);
  }

  return body as MainBackendSession;
}

/**
 * POST /student/mark-attendance on the main backend.
 * This single call covers enrollment verification, the
 * isAttendanceOpen check, and duplicate-attendance prevention — all of
 * that logic already lives on the main backend and is not duplicated
 * here.
 */
export async function markAttendanceOnMainBackend(
  sessionId: number,
  authToken: string
): Promise<{ message: string }> {
  const res = await fetch(`${env.MAIN_API_URL}/student/mark-attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authToken,
    },
    body: JSON.stringify({ sessionId }),
  });

  const body = await parseJsonSafe(res);

  if (!res.ok) {
    throw new UpstreamApiError(messageFrom(body, "Failed to mark attendance"), res.status, body);
  }

  return body as { message: string };
}
