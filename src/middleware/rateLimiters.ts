import rateLimit from "express-rate-limit";

/**
 * /verify is the endpoint most worth protecting: a scripted client
 * with a stolen QR frame could hammer it trying to win a race against
 * the 5s token rotation. This doesn't replace the token-rotation
 * defense, it just caps brute-force attempts per IP.
 */
export const verifyRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification attempts. Please wait a moment and try again." },
});

/**
 * /start is teacher-only and far lower frequency, but still worth a
 * generous cap to blunt accidental retry loops or misbehaving clients.
 */
export const startRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please wait a moment and try again." },
});
