import { initRecognitionWorker, closeRecognitionWorker } from "./recognition.worker.js";
import { initDeliveryWorker, closeDeliveryWorker } from "./delivery.worker.js";
import { logger } from "../config/logger.js";

/**
 * Initialize all registered background workers.
 * @param {object} io - Socket.io instance or custom emitter abstraction
 */
export function initAllWorkers(io) {
  logger.info("Initializing all background workers...");
  initRecognitionWorker(io);
  initDeliveryWorker();
}

/**
 * Gracefully shuts down all active workers.
 * @returns {Promise<void>}
 */
export async function closeAllWorkers() {
  logger.info("Shutting down all worker connection instances...");
  try {
    await Promise.all([
      closeRecognitionWorker(),
      closeDeliveryWorker()
    ]);
    logger.info("All worker processes closed cleanly.");
  } catch (err) {
    logger.error({ err }, "Error closing workers during bootstrap shutdown");
  }
}

