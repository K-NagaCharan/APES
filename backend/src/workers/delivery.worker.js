import { Worker } from "bullmq";
import { bullMQConnection } from "../config/bullmq.js";
import { logger } from "../config/logger.js";
import { emitDeliveryDone, emitDeliveryFailed } from "../socket/events.js";
import DeliveryHistory from "../models/DeliveryHistory.js";

const WORKER_NAME = "deliveryQueue";

export const deliveryHelpers = {
  mockDeliverPhotos: async (data) => {
    // Simulate network delivery latency
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return true;
  }
};

let deliveryWorker = null;
let socketEmitter = null;

/**
 * Initializes the delivery worker with an optional socket emitter.
 * @param {object} emitter - Socket.io instance or custom emitter abstraction
 * @returns {object} - BullMQ Worker instance
 */
export const initDeliveryWorker = (emitter) => {
  if (deliveryWorker) {
    return deliveryWorker;
  }

  socketEmitter = emitter;

  deliveryWorker = new Worker(
    WORKER_NAME,
    async (job) => {
      const { requestId } = job.data;
      logger.info({ jobId: job.id, requestId }, "Delivery worker job started");

      try {
        // Execute delivery operation generically
        await deliveryHelpers.mockDeliverPhotos(job.data);

        logger.info(
          { jobId: job.id, requestId },
          "Delivery worker job completed successfully"
        );

        // Emit delivery:done event
        try {
          if (socketEmitter && requestId) {
            const deliveryRecord = await DeliveryHistory.findById(requestId);
            if (deliveryRecord && deliveryRecord.userId) {
              emitDeliveryDone(socketEmitter, deliveryRecord.userId, {
                jobId: job.id,
                success: true,
                deliveryId: requestId
              });
            }
          }
        } catch (emitError) {
          logger.warn(
            { jobId: job.id, err: emitError.message },
            "Failed to emit delivery:done event"
          );
        }

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
  deliveryWorker.on("failed", async (job, err) => {
    logger.error(
      { jobId: job?.id, attemptsMade: job?.attemptsMade, err: err.message },
      "Delivery worker job failed permanently"
    );

    // Emit delivery:failed only on the final failure attempt
    const maxAttempts = job?.opts?.attempts || 1;
    const attemptsMade = job?.attemptsMade || 0;
    if (attemptsMade >= maxAttempts) {
      try {
        if (socketEmitter && job.data?.requestId) {
          const deliveryRecord = await DeliveryHistory.findById(job.data.requestId);
          if (deliveryRecord && deliveryRecord.userId) {
            emitDeliveryFailed(socketEmitter, deliveryRecord.userId, {
              jobId: job.id,
              success: false,
              deliveryId: job.data.requestId,
              reason: err.message
            });
          }
        }
      } catch (emitError) {
        logger.warn(
          { jobId: job?.id, err: emitError.message },
          "Failed to emit delivery:failed event"
        );
      }
    }
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

