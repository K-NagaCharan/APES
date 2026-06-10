import { Worker } from "bullmq";
import { bullMQConnection } from "../config/bullmq.js";
import { logger } from "../config/logger.js";

const WORKER_NAME = "deliveryQueue";

/**
 * Mock dispatcher to simulate photo delivery (email / WhatsApp).
 * @param {object} data - Generic job payload from the queue
 * @returns {Promise<boolean>}
 */
export async function mockDeliverPhotos(data) {
  // Simulate network delivery latency
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return true;
}

let deliveryWorker = null;

/**
 * Initializes the delivery worker.
 * @returns {object} - BullMQ Worker instance
 */
export const initDeliveryWorker = () => {
  if (deliveryWorker) {
    return deliveryWorker;
  }

  deliveryWorker = new Worker(
    WORKER_NAME,
    async (job) => {
      logger.info({ jobId: job.id }, "Delivery worker job started");

      try {
        // Execute delivery operation generically
        await mockDeliverPhotos(job.data);

        logger.info(
          { jobId: job.id },
          "Delivery worker job completed successfully"
        );

        return {
          success: true,
          processed: true,
          mock: true
        };
      } catch (err) {
        logger.error(
          { jobId: job.id, attemptsMade: job.attemptsMade, err: err.message },
          "Delivery worker job processing error occurred"
        );
        // Rethrow to let BullMQ retry policies handle recovery
        throw err;
      }
    },
    {
      connection: bullMQConnection,
      concurrency: parseInt(process.env.DELIVERY_WORKER_CONCURRENCY || "1", 10)
    }
  );

  // Worker lifecycle event telemetry
  deliveryWorker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, attemptsMade: job?.attemptsMade, err: err.message },
      "Delivery worker job failed permanently"
    );
  });

  deliveryWorker.on("error", (err) => {
    logger.error({ err: err.message }, "Delivery worker encountered connection or operational error");
  });

  return deliveryWorker;
};

/**
 * Returns the active delivery worker instance (or null if not initialized).
 * @returns {object|null}
 */
export const getDeliveryWorker = () => deliveryWorker;

/**
 * Gracefully shuts down the delivery worker.
 * @returns {Promise<void>}
 */
export async function closeDeliveryWorker() {
  if (!deliveryWorker || deliveryWorker.status === "closed") {
    return;
  }
  try {
    await deliveryWorker.close();
    logger.info("Delivery worker disconnected gracefully.");
  } catch (err) {
    logger.error({ err }, "Error shutting down delivery worker");
  }
}

