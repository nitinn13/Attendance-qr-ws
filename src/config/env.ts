import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Base URL of the main backend (Express + Prisma) that owns
  // Class / Session / Enrollment / Attendance.
  MAIN_API_URL: z.string().url(),

  // How long a teacher's QR run stays alive before auto-expiring.
  QR_SESSION_DURATION_MS: z.coerce.number().int().positive().default(30_000),

  // How often the displayed QR token rotates while a session is active.
  QR_TOKEN_REFRESH_MS: z.coerce.number().int().positive().default(5_000),

  // Allowed origin(s) for CORS, comma-separated. Falls back to "*" only
  // in development; production should always set this explicitly.
  CORS_ORIGIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
