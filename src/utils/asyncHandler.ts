import { type Request, type Response, type NextFunction, type RequestHandler } from "express";

/**
 * Wraps an async Express handler so rejected promises are forwarded to
 * next(err) instead of becoming an unhandled rejection. Keeps
 * controllers free of repetitive try/catch blocks.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
