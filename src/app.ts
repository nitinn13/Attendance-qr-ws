import express, { type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import qrRoutes from "./routes/qrRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",") : true,
      credentials: true,
    })
  );

  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "qr-attendance" });
  });

  app.use("/qr", qrRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
