/**
 * Raised when a call to the main backend fails. Carries the upstream
 * status code and message so the QR backend can mirror it back to the
 * client instead of collapsing everything to a generic 500.
 */
export class UpstreamApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "UpstreamApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Raised for QR-domain errors local to this service (expired token,
 * mismatched token, no active session, etc). Always maps to 400.
 */
export class QrSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QrSessionError";
  }
}
