import IORedis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * WARNING: The bullMQConnection instance is reserved exclusively for BullMQ
 * queues, workers, and scheduler operations. Do NOT use this connection instance
 * for general application cache or session storage operations.
 */
export const bullMQConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required option for BullMQ queue stability
  retryStrategy: (times) => {
    const delay = Math.min(times * 200, 2000);
    logger.warn(`BullMQ Redis reconnect attempt #${times}, next try in ${delay}ms`);
    return delay;
  },
});

// Telemetry/Logging event listeners
bullMQConnection.on("connect", () => {
  logger.info("BullMQ Redis client connected");
});

bullMQConnection.on("ready", () => {
  logger.info("BullMQ Redis client ready");
});

bullMQConnection.on("error", (err) => {
  logger.error({ err }, "BullMQ Redis client error");
});

/**
 * Idempotently and gracefully closes the BullMQ Redis connection.
 * @returns {Promise<void>}
 */
export async function closeBullMQConnection() {
  if (bullMQConnection.status === "end") {
    logger.info("BullMQ connection already closed");
    return;
  }

  try {
    await bullMQConnection.quit();
    logger.info("BullMQ Redis client disconnected gracefully.");
  } catch (err) {
    logger.error({ err }, "Error quitting BullMQ Redis client during shutdown");
  }
}
