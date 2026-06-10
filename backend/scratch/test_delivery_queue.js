import { addDeliveryJob } from "../src/queues/delivery.queue.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";
import { logger } from "../src/config/logger.js";

async function runTest() {
  const requestId = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3d4f10";

  logger.info("Test 1: Adding a delivery job...");
  const job1 = await addDeliveryJob({ requestId });
  logger.info({ id: job1.id, data: job1.data }, "Job 1 created successfully");

  // Verify that only requestId is in the job data
  if (job1.data.requestId !== requestId || Object.keys(job1.data).length !== 1) {
    throw new Error(`Data validation failed. Expected only requestId, got: ${JSON.stringify(job1.data)}`);
  }
  logger.info("Job data verified successfully: contains only requestId.");

  logger.info("Test 2: Adding duplicate job with the same requestId...");
  const job2 = await addDeliveryJob({ requestId });
  logger.info({ id: job2.id }, "Job 2 added (should be deduplicated)");

  if (job1.id !== job2.id) {
    throw new Error(`Deduplication failed! Job IDs differ: ${job1.id} !== ${job2.id}`);
  }
  logger.info("Deduplication verification successful: Job IDs match!");

  // Clean up
  await closeBullMQConnection();
  process.exit(0);
}

runTest().catch(async (err) => {
  logger.error({ err }, "Test failed");
  await closeBullMQConnection();
  process.exit(1);
});
