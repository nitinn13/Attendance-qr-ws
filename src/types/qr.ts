/**
 * A live, rotating QR run for one Session (one specific class date)
 * on the main backend. Lives entirely in memory — this service has
 * no database of its own.
 */
export interface ActiveQrSession {
  /** Master token identifying this particular QR run. Changes every time a new run starts. */
  qrToken: string;

  /** The main backend's Session.id this QR run is tied to. */
  sessionId: number;

  classId: number;
  className: string;

  /** The token currently encoded in the displayed QR image. Rotates every QR_TOKEN_REFRESH_MS. */
  currentToken: string;

  /** Data URL of the current QR code image. */
  qrImage: string;

  /** Absolute expiry timestamp (ms epoch). */
  expiresAt: number;

  /** When this run started (ms epoch). */
  startedAt: number;
}

/** Public shape returned to clients — internal timers excluded. */
export type PublicQrSession = Pick<
  ActiveQrSession,
  "sessionId" | "classId" | "className" | "qrToken" | "currentToken" | "qrImage" | "expiresAt" | "startedAt"
>;

export interface MainBackendSession {
  id: number;
  classId: number;
  className: string;
  date: string;
  isAttendanceOpen: boolean;
}

export interface MainBackendErrorBody {
  message?: string;
}
