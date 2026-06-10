import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { initDeliveryWorker, closeDeliveryWorker, getDeliveryWorker, deliveryHelpers } from "../src/workers/delivery.worker.js";
import { addDeliveryJob } from "../src/queues/delivery.queue.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";
import { logger } from "../src/config/logger.js";
import redis from "../src/config/redis.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";

async function runDeliveryEventsTest() {
  await connectDB();

  // Test User ID
  const testUserId = new mongoose.Types.ObjectId();

  // Track event emissions chronologically
  const emittedEvents = [];
  const spyEmitter = {
    to(room) {
      return {
        emit(event, payload) {
          emittedEvents.push({
            timestamp: Date.now(),
            room: room.toString(),
            event,
            payload
          });
        }
      };
    }
  };

  // Initialize delivery worker with spyEmitter
  logger.info("Initializing delivery worker with spy emitter...");
  initDeliveryWorker(spyEmitter);

  const worker = getDeliveryWorker();

  // ----------------------------------------------------
  // TEST CASE 1: Successful Delivery Flow
  // ----------------------------------------------------
  logger.info("--- TEST 1: Successful Delivery Flow ---");
  
  // Create a success DeliveryHistory record
  const successRecord = new DeliveryHistory({
    userId: testUserId,
    recipient: "success@example.com",
    medium: "email",
    photoIds: [new mongoose.Types.ObjectId()],
    status: "queued"
  });
  await successRecord.save();

  // Stub mockDeliverPhotos to succeed quickly
  deliveryHelpers.mockDeliverPhotos = async (data) => {
    logger.info({ data }, "Test mockDeliverPhotos (Success stub) called");
    return true;
  };

  // Enqueue successful job
  let successJobPromise = new Promise((resolve) => {
    worker.on("completed", (job) => {
      if (job.data.requestId === successRecord._id.toString()) {
        logger.info({ jobId: job.id }, "Success job completed in worker");
        resolve(job);
      }
    });
  });

  const successJob = await addDeliveryJob({ requestId: successRecord._id });
  await successJobPromise;

  // Assertions for Success Event
  const successDoneEvents = emittedEvents.filter(
    (e) => e.event === "delivery:done" && e.payload.deliveryId === successRecord._id.toString()
  );

  if (successDoneEvents.length !== 1) {
    logger.error(`Expected exactly 1 delivery:done event for success record, got ${successDoneEvents.length}`);
    process.exit(1);
  }

  const successEvent = successDoneEvents[0];
  if (successEvent.room !== testUserId.toString()) {
    logger.error(`Success event room mismatch. Expected ${testUserId.toString()}, got ${successEvent.room}`);
    process.exit(1);
  }

  if (successEvent.payload.success !== true) {
    logger.error("Success payload value mismatch: success should be true");
    process.exit(1);
  }

  if (successEvent.payload.jobId !== successJob.id) {
    logger.error(`Success jobId mismatch: expected ${successJob.id}, got ${successEvent.payload.jobId}`);
    process.exit(1);
  }

  logger.info("Success Flow Assertion PASSED.");

  // ----------------------------------------------------
  // TEST CASE 2: Failed Delivery Flow (Retry Exhaustion)
  // ----------------------------------------------------
  logger.info("--- TEST 2: Failed Delivery Flow (Retry Exhaustion) ---");

  // Clear tracked events list
  emittedEvents.length = 0;

  // Create a failed DeliveryHistory record
  const failedRecord = new DeliveryHistory({
    userId: testUserId,
    recipient: "fail@example.com",
    medium: "whatsapp",
    photoIds: [new mongoose.Types.ObjectId()],
    status: "queued"
  });
  await failedRecord.save();

  // Stub mockDeliverPhotos to throw error and trigger retries
  let attemptsRun = 0;
  deliveryHelpers.mockDeliverPhotos = async (data) => {
    attemptsRun++;
    logger.info({ data, attempt: attemptsRun }, "Test mockDeliverPhotos (Failure stub) executing...");
    throw new Error("SMTP connection refused");
  };

  // Enqueue failed job (which has attempts: 3 in default options)
  let failedJobPromise = new Promise((resolve) => {
    worker.on("failed", (job, err) => {
      if (job && job.data && job.data.requestId === failedRecord._id.toString()) {
        const attemptsMade = job.attemptsMade;
        logger.info({ jobId: job.id, attemptsMade, err: err.message }, "Failed job listener callback fired");
        // BullMQ default attempts = 3. Fails permanently on attempt 3.
        if (attemptsMade >= 3) {
          resolve(job);
        }
      }
    });
  });

  const failedJob = await addDeliveryJob({ requestId: failedRecord._id });
  await failedJobPromise;

  // Add a small delay for the async failed listener in the worker to complete its DB query and emit the event
  logger.info("Waiting for async worker emit handler to complete...");
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Assertions for Retry Failure events
  const failedEvents = emittedEvents.filter(
    (e) => e.event === "delivery:failed" && e.payload.deliveryId === failedRecord._id.toString()
  );

  // Check that failed event is only triggered once at the very end
  if (failedEvents.length !== 1) {
    logger.error(`Expected exactly 1 final delivery:failed event, got ${failedEvents.length}`);
    process.exit(1);
  }

  const failEvent = failedEvents[0];
  if (failEvent.room !== testUserId.toString()) {
    logger.error(`Fail event room mismatch. Expected ${testUserId.toString()}, got ${failEvent.room}`);
    process.exit(1);
  }

  if (failEvent.payload.success !== false) {
    logger.error("Fail payload value mismatch: success should be false");
    process.exit(1);
  }

  if (failEvent.payload.jobId !== failedJob.id) {
    logger.error(`Fail jobId mismatch: expected ${failedJob.id}, got ${failEvent.payload.jobId}`);
    process.exit(1);
  }

  if (failEvent.payload.reason !== "SMTP connection refused") {
    logger.error(`Fail reason mismatch: expected "SMTP connection refused", got "${failEvent.payload.reason}"`);
    process.exit(1);
  }

  logger.info("Failed Flow & Retry Exhaustion Assertion PASSED.");

  // ----------------------------------------------------
  // Clean up
  // ----------------------------------------------------
  logger.info("Closing connections and cleaning up DB records...");
  await closeDeliveryWorker();
  await DeliveryHistory.deleteOne({ _id: successRecord._id });
  await DeliveryHistory.deleteOne({ _id: failedRecord._id });
  await redis.quit();
  await closeBullMQConnection();
  await mongoose.disconnect();
  
  logger.info("Clean shutdown complete.");
  logger.info("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

runDeliveryEventsTest().catch((err) => {
  logger.error({ err }, "Test exception occurred");
  process.exit(1);
});
