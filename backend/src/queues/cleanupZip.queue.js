import { Queue } from "bullmq";
import { bullMQConnection } from "../config/bullmq.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

const QUEUE_NAME = process.env.ZIP_CLEANUP_QUEUE_NAME || "zipCleanupQueue";

// Create the singleton queue instance
export const cleanupZipQueue = new Queue(QUEUE_NAME, {
  connection: bullMQConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times on transient errors
    backoff: {
      type: "exponential",
      delay: 1000 // Start backoff delay at 1s, then 2s, 4s...
    },
    removeOnComplete: {
      count: 100 // Keep the last 100 completed jobs
    },
    removeOnFail: {
      count: 1000 // Keep the last 1000 failed jobs
    }
  }
});

/**
 * Schedule the repeatable ZIP cleanup job to run at configured intervals.
 * 
 * @returns {Promise<object>} The repeatable job info.
 */
export async function scheduleZipCleanup() {
  const intervalHours = env.ZIP_CLEANUP_INTERVAL_HOURS || 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  try {
    // Add repeatable job to the queue
    const job = await cleanupZipQueue.add(
      "cleanup-expired-zips",
      {},
      {
        repeat: {
          every: intervalMs
        },
        jobId: "zip-cleanup-repeatable"
      }
    );
    logger.info({ jobId: job.id, intervalHours }, "Successfully scheduled repeatable ZIP cleanup job");
    return job;
  } catch (err) {
    logger.error({ err }, "Failed to schedule repeatable ZIP cleanup job");
    throw err;
  }
}
