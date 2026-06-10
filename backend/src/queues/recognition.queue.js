import { Queue } from "bullmq";
import { bullMQConnection } from "../config/bullmq.js";
import { logger } from "../config/logger.js";

const QUEUE_NAME = "recognitionQueue";

// Create the singleton queue instance
export const recognitionQueue = new Queue(QUEUE_NAME, {
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
 * Add a face recognition processing job to the queue.
 * @param {object} data - Job payload: { photoId }
 * @param {string|object} data.photoId - MongoDB ObjectId of the photo to process
 * @returns {Promise<object>} The added or existing BullMQ Job instance
 */
export async function addRecognitionJob(data) {
  if (!data || !data.photoId) {
    throw new Error("Invalid job data. Required: photoId");
  }

  const photoIdStr = data.photoId.toString();

  try {
    // Enforce deduplication at the queue level by using the photoId as the BullMQ jobId
    const job = await recognitionQueue.add(
      "recognize-face",
      { photoId: photoIdStr },
      { jobId: photoIdStr }
    );
    logger.info({ jobId: job.id, photoId: photoIdStr }, "Successfully queued photo for recognition");
    return job;
  } catch (err) {
    logger.error({ err, photoId: photoIdStr }, "Failed to add job to recognition queue");
    throw err;
  }
}
