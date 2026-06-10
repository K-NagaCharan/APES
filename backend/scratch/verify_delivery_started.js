import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { initDeliveryWorker, closeDeliveryWorker, getDeliveryWorker, deliveryHelpers } from "../src/workers/delivery.worker.js";
import { addDeliveryJob } from "../src/queues/delivery.queue.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";
import { logger } from "../src/config/logger.js";
import redis from "../src/config/redis.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";

const assert = (condition, message) => {
  if (!condition) {
    logger.error(`Assertion Failed: ${message}`);
    process.exit(1);
  }
};

async function runDeliveryStartedTest() {
  logger.info("Initializing DB and connections...");
  await connectDB();

  const testUserId = new mongoose.Types.ObjectId();
  const emittedEvents = [];

  // Spy socket emitter mapping
  const spyEmitter = {
    to(room) {
      return {
        emit(event, payload) {
          logger.info({ event, payload, room }, "Captured event emission spy");
          emittedEvents.push({
            room: room.toString(),
            event,
            payload
          });
        }
      };
    }
  };

  // Start worker with spy emitter
  initDeliveryWorker(spyEmitter);
  const worker = getDeliveryWorker();

  // 1. Create a dummy delivery record
  const deliveryRecord = new DeliveryHistory({
    userId: testUserId,
    recipient: "test@example.com",
    medium: "email",
    photoIds: [new mongoose.Types.ObjectId()],
    status: "queued"
  });
  await deliveryRecord.save();

  // Stub delivery execution behavior
  deliveryHelpers.mockDeliverPhotos = async (data) => {
    logger.info({ data }, "Running mockDeliverPhotos stub (immediate success)...");
    return true;
  };

  // Enqueue job and wait for completed worker hook
  const jobDonePromise = new Promise((resolve) => {
    worker.on("completed", (job) => {
      if (job.data.requestId === deliveryRecord._id.toString()) {
        logger.info({ jobId: job.id }, "Job finished in worker callback");
        resolve(job);
      }
    });
  });

  const jobInstance = await addDeliveryJob({ requestId: deliveryRecord._id });
  await jobDonePromise;

  // Let async event loops catch up for database status update to complete
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Assert events list
  logger.info("Verifying emitted events contract...");

  const startedEvents = emittedEvents.filter(e => e.event === "delivery:started");
  assert(startedEvents.length === 1, `Expected exactly 1 delivery:started event, got ${startedEvents.length}`);
  
  const startedPayload = startedEvents[0].payload;
  assert(startedPayload.jobId === jobInstance.id, `Expected started event jobId ${jobInstance.id}, got ${startedPayload.jobId}`);
  assert(startedPayload.deliveryId === deliveryRecord._id.toString(), `Expected started event deliveryId ${deliveryRecord._id}, got ${startedPayload.deliveryId}`);

  const doneEvents = emittedEvents.filter(e => e.event === "delivery:done");
  assert(doneEvents.length === 1, `Expected exactly 1 delivery:done event, got ${doneEvents.length}`);

  const donePayload = doneEvents[0].payload;
  assert(donePayload.jobId === jobInstance.id, `Expected done event jobId ${jobInstance.id}, got ${donePayload.jobId}`);
  assert(donePayload.deliveryId === deliveryRecord._id.toString(), `Expected done event deliveryId ${deliveryRecord._id}, got ${donePayload.deliveryId}`);
  assert(donePayload.success === true, "Expected success: true in done event");

  logger.info("ALL EMISSION CHECKS PASSED!");

  // Clean up
  await closeDeliveryWorker();
  await DeliveryHistory.deleteOne({ _id: deliveryRecord._id });
  await redis.quit();
  await closeBullMQConnection();
  await mongoose.disconnect();
  
  logger.info("Shuting down verification script.");
  process.exit(0);
}

runDeliveryStartedTest().catch((err) => {
  logger.error({ err }, "Unhandled error during test execution");
  process.exit(1);
});
