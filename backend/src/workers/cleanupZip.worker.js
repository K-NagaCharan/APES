import { Worker } from "bullmq";
import { bullMQConnection } from "../config/bullmq.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import DeliveryHistory from "../models/DeliveryHistory.js";
import cloudinary from "../config/cloudinary.js";

const WORKER_NAME = process.env.ZIP_CLEANUP_QUEUE_NAME || "zipCleanupQueue";

/**
 * Main execution logic for ZIP cleanup.
 * Scans DeliveryHistory for expired ZIP archives and requests deletion from Cloudinary.
 * 
 * @returns {Promise<object>} Result containing cleanedCount.
 */
export async function processZipCleanup() {
  logger.info("Executing ZIP cleanup process...");

  const retentionHours = env.ZIP_RETENTION_HOURS || 24;
  const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

  // Retrieve records with format 'zip', public ID present as a non-empty string, and deliveredAt older than cutoffTime
  const expiredDeliveries = await DeliveryHistory.find({
    format: "zip",
    cloudinaryPublicId: { $type: "string", $ne: "" },
    deliveredAt: { $lt: cutoffTime }
  });

  logger.info(
    { expiredCount: expiredDeliveries.length, cutoffTime },
    "Found expired ZIP delivery records for cleanup"
  );

  for (const delivery of expiredDeliveries) {
    const publicId = delivery.cloudinaryPublicId;
    logger.info({ deliveryId: delivery._id, publicId }, "Removing expired ZIP archive from Cloudinary");

    try {
      // Call uploader.destroy via our stub-friendly helper object
      const result = await cleanupHelpers.destroyCloudinaryAsset(publicId);
      logger.info({ deliveryId: delivery._id, result }, "Cloudinary destroy result");

      // Check if deletion succeeded or was already deleted (not found)
      if (result.result === "ok" || result.result === "not found") {
        delivery.zipUrl = null;
        delivery.cloudinaryPublicId = null;
        delivery.zipDeletedAt = new Date();
        await delivery.save();
        logger.info({ deliveryId: delivery._id }, "Expired ZIP delivery record successfully updated in-place");
      } else {
        throw new Error(`Cloudinary returned unexpected status: ${result.result}`);
      }
    } catch (err) {
      logger.error(
        { err: err.message, deliveryId: delivery._id, publicId },
        "Error cleaning up expired ZIP archive from Cloudinary"
      );
      // Propagate the error so BullMQ retry policy will handle recovery of this job
      throw err;
    }
  }

  return { cleanedCount: expiredDeliveries.length };
}

// Wrapper helper to allow clean E2E test stubs
export const cleanupHelpers = {
  destroyCloudinaryAsset: async (publicId) => {
    return await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  }
};

let cleanupWorker = null;

/**
 * Initializes the singleton BullMQ worker for ZIP cleanup tasks.
 * 
 * @returns {object} The BullMQ Worker instance.
 */
export function initCleanupWorker() {
  if (cleanupWorker) {
    return cleanupWorker;
  }

  cleanupWorker = new Worker(
    WORKER_NAME,
    async (job) => {
      logger.info({ jobId: job.id, jobName: job.name }, "ZIP cleanup worker job execution started");
      if (job.name === "cleanup-expired-zips") {
        return await processZipCleanup();
      }
    },
    {
      connection: bullMQConnection,
      concurrency: 1
    }
  );

  cleanupWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "ZIP cleanup job failed permanently or requires retry");
  });

  cleanupWorker.on("error", (err) => {
    logger.error({ err: err.message }, "ZIP cleanup worker encountered an error");
  });

  return cleanupWorker;
}

/**
 * Gracefully shuts down the cleanup worker.
 */
export async function closeCleanupWorker() {
  if (!cleanupWorker || cleanupWorker.status === "closed") {
    return;
  }
  try {
    await cleanupWorker.close();
    logger.info("ZIP cleanup worker disconnected gracefully.");
  } catch (err) {
    logger.error({ err }, "Error shutting down ZIP cleanup worker");
  } finally {
    cleanupWorker = null;
  }
}
