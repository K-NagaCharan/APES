import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import redis from "../src/config/redis.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";
import { logger } from "../src/config/logger.js";
import Photo from "../src/models/Photo.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";
import { addDeliveryJob } from "../src/queues/delivery.queue.js";
import { initDeliveryWorker, closeDeliveryWorker, getDeliveryWorker, deliveryHelpers } from "../src/workers/delivery.worker.js";
import { EmailServiceError } from "../src/services/email.service.js";

const assert = (condition, message) => {
  if (!condition) {
    logger.error(`Assertion Failed: ${message}`);
    process.exit(1);
  }
};

async function runTests() {
  logger.info("Initializing DB and Redis connections...");
  await connectDB();

  const testUserId = new mongoose.Types.ObjectId().toString();
  const testPhoto = await Photo.create({
    userId: testUserId,
    url: "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1/test_portrait.png",
    cloudinaryPublicId: "test_portrait",
    status: "completed",
    uploadDate: new Date()
  });

  const photoIds = [testPhoto._id];
  const emittedEvents = [];
  const spyEmitter = {
    to(room) {
      return {
        emit(event, payload) {
          logger.info({ event, payload, room }, "Captured event emission spy");
          emittedEvents.push({ room: room.toString(), event, payload });
        }
      };
    }
  };

  // Start the delivery worker with the spy emitter
  initDeliveryWorker(spyEmitter);
  const worker = getDeliveryWorker();

  try {
    try {
      // ----------------------------------------------------
      // Scenario 1: Successful Email Delivery Flow
      // ----------------------------------------------------
      logger.info("--- Scenario 1: Successful Email Delivery Flow ---");
      
      // Create queued DeliveryHistory record
      const deliveryRecord1 = new DeliveryHistory({
        userId: testUserId,
        recipient: "photosofapes@gmail.com",
        medium: "email",
        photoIds,
        status: "queued"
      });
      await deliveryRecord1.save();
      assert(deliveryRecord1.status === "queued", "Record 1 should start as queued");

      // Stub sendEmail to simulate success
      const originalSendEmail = deliveryHelpers.sendEmail;
      deliveryHelpers.sendEmail = async ({ recipient, subject, photos }) => {
        logger.info({ recipient, subject, photosCount: photos.length }, "Stubbed sendEmail called");
        return {
          messageId: "mock-email-message-id-12345",
          recipient,
          timestamp: new Date()
        };
      };

      // Wait for worker to complete the job
      const jobDonePromise1 = new Promise((resolve) => {
        worker.once("completed", (job) => {
          if (job.data.requestId === deliveryRecord1._id.toString()) {
            resolve(job);
          }
        });
      });

      await addDeliveryJob({ requestId: deliveryRecord1._id.toString() });
      await jobDonePromise1;

      // Wait for DB write to settle
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Verify record update
      const updatedRecord1 = await DeliveryHistory.findById(deliveryRecord1._id);
      assert(updatedRecord1.status === "delivered", "Record 1 status should be delivered");
      assert(updatedRecord1.format === "links", "Record 1 format should be links");
      assert(updatedRecord1.count === 1, "Record 1 count should be 1");
      assert(updatedRecord1.messageId === "mock-email-message-id-12345", "Record 1 messageId mismatch");
      assert(updatedRecord1.deliveredAt !== undefined, "Record 1 should have deliveredAt timestamp");

      // Verify socket emission
      const doneEvent = emittedEvents.find(e => e.event === "delivery:done" && e.payload.deliveryId === deliveryRecord1._id.toString());
      assert(doneEvent !== undefined, "Should emit delivery:done socket event");
      assert(doneEvent.payload.success === true, "Should report success: true in socket event");

      // Restore original sendEmail
      deliveryHelpers.sendEmail = originalSendEmail;
      logger.info("Scenario 1 PASSED.");

      // ----------------------------------------------------
      // Scenario 2: Service Failure Propagation Flow
      // ----------------------------------------------------
      logger.info("--- Scenario 2: Service Failure Propagation Flow ---");

      // Create queued DeliveryHistory record
      const deliveryRecord2 = new DeliveryHistory({
        userId: testUserId,
        recipient: "fail@example.com",
        medium: "email",
        photoIds,
        status: "queued"
      });
      await deliveryRecord2.save();

      // Stub sendEmail to throw structured error
      deliveryHelpers.sendEmail = async () => {
        throw new EmailServiceError("Simulated SMTP timeout failure", { code: "ETIMEOUT" });
      };

      // Wait for worker to report job failure
      const jobFailedPromise2 = new Promise((resolve) => {
        worker.once("failed", (job, err) => {
          if (job.data.requestId === deliveryRecord2._id.toString()) {
            resolve({ job, err });
          }
        });
      });

      // Enqueue job with 1 attempt to fail immediately
      await addDeliveryJob({ requestId: deliveryRecord2._id.toString() }, { attempts: 1 });
      const { err: workerErr } = await jobFailedPromise2;

      // Verify error was propagated
      assert(workerErr.message.includes("Simulated SMTP timeout failure"), `Should propagate error, got: ${workerErr.message}`);

      // Wait for DB write to settle
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Verify record updated to failed in-place
      const updatedRecord2 = await DeliveryHistory.findById(deliveryRecord2._id);
      assert(updatedRecord2.status === "failed", "Record 2 status should be failed");
      assert(updatedRecord2.error.includes("Simulated SMTP timeout failure"), `Record 2 error should contain reason, got: ${updatedRecord2.error}`);

      // Verify socket emission
      const failedEvent = emittedEvents.find(e => e.event === "delivery:failed" && e.payload.deliveryId === deliveryRecord2._id.toString());
      assert(failedEvent !== undefined, "Should emit delivery:failed socket event");
      assert(failedEvent.payload.success === false, "Should report success: false in socket event");
      assert(failedEvent.payload.reason.includes("Simulated SMTP timeout failure"), "Should include reason in socket event");

      // Restore original sendEmail
      deliveryHelpers.sendEmail = originalSendEmail;
      logger.info("Scenario 2 PASSED.");

      logger.info("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!");
    } catch (scenarioErr) {
      logger.error({ err: scenarioErr.message, stack: scenarioErr.stack }, "Scenario execution threw error");
      throw scenarioErr;
    }
  } finally {
    // Cleanup
    logger.info("Cleaning up mock database records...");
    await Photo.deleteOne({ _id: testPhoto._id });
    await DeliveryHistory.deleteMany({ userId: testUserId });
    await closeDeliveryWorker();
    await redis.quit();
    await closeBullMQConnection();
    await mongoose.disconnect();
    logger.info("Clean shutdown complete.");
  }
}

runTests().catch(async (err) => {
  logger.error({ err: err.message, stack: err.stack }, "Integration tests execution failed");
  await closeDeliveryWorker().catch(() => {});
  await redis.quit().catch(() => {});
  await closeBullMQConnection().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
