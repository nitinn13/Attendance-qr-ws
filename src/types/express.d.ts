import "express";

declare global {
  namespace Express {
    interface Request {
      /**
       * The raw "Bearer <token>" header forwarded from the client.
       * This service never decodes or validates the JWT itself — it is
       * passed through as-is to the main backend, which owns auth.
       * Populated by requireAuthHeader middleware.
       */
      authToken?: string;
    }
  }
}
