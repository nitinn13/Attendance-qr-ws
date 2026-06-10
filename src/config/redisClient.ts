import { createClient, type RedisClientType } from "redis";
import dotenv from "dotenv";

dotenv.config();

let redisClient: RedisClientType;

export const connectRedis = async (): Promise<void> => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  // Upstash requires TLS. If connecting to Upstash, we enforce the socket.tls configuration.
  const isUpstash = redisUrl.includes("upstash.io");

  redisClient = createClient({
    url: redisUrl,
    socket: {
      tls: isUpstash ? true : false,
      rejectUnauthorized: false // Ensures connection smoothly handles managed certificates
    }
  });

  redisClient.on("error", (err: Error) => {
    console.error("Redis Client Error:", err);
  });

  await redisClient.connect();
  console.log("🚀 Connected to Cloud Redis successfully!");
};

export { redisClient };