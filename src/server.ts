import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 QR attendance service running at http://localhost:${env.PORT}`);
  console.log(`   Forwarding to main backend at ${env.MAIN_API_URL}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${env.PORT} is already in use. Please stop the other process.`);
    process.exit(1);
  } else {
    console.error("Server error:", err);
    process.exit(1);
  }
});

function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason: unknown) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err: Error) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
