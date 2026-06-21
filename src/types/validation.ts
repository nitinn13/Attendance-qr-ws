import { z } from "zod";

export const startQrSchema = z.object({
  sessionId: z.number().int().positive(),
});

export const stopQrSchema = z.object({
  sessionId: z.number().int().positive(),
});

export const verifyQrSchema = z.object({
  sessionId: z.number().int().positive(),
  qrToken: z.string().min(1),
  token: z.string().min(1),
});

export const activeSessionQuerySchema = z.object({
  sessionId: z.coerce.number().int().positive(),
});
