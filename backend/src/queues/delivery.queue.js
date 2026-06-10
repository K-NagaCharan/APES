import { Queue } from "bullmq";
import { bullMQConnection } from "../config/bullmq.js";
import { logger } from "../config/logger.js";

const QUEUE_NAME = "deliveryQueue";

// Create the singleton queue instance
export const deliveryQueue = new Queue(QUEUE_NAME, {
  connection: bullMQConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times on transient errors
    backoff: {
      type: "exponential",
      delay: 1000 // Start backoff delay at 1s, then 2s, 4s...
    },
    removeOnComplete: {
      count: 1000 // Keep the last 1000 completed jobs
    },
    removeOnFail: {
      count: 5000 // Keep the last 5000 failed jobs
    }
  }
});

/**
 * Add a delivery task job to the queue.
 * @param {object} data - Job payload: { requestId }
 * @param {string} data.requestId - Unique identifier of the delivery request
 * @returns {Promise<object>} The added or existing BullMQ Job instance
 */
export async function addDeliveryJob(data) {
  if (!data || !data.requestId) {
    throw new Error("Invalid job data. Required: requestId");
  }

  const requestIdStr = data.requestId.toString();

  try {
    // Enforce deduplication at the queue level by using the requestId as the BullMQ jobId
    const job = await deliveryQueue.add(
      "deliver-photos",
      { requestId: requestIdStr },
      { jobId: requestIdStr }
    );
    logger.info({ jobId: job.id, requestId: requestIdStr }, "Successfully queued delivery job");
    return job;
  } catch (err) {
    logger.error({ err, requestId: requestIdStr }, "Failed to add job to delivery queue");
    throw err;
  }
}
