import { addRecognitionJob } from "../src/queues/recognition.queue.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";
import { logger } from "../src/config/logger.js";

async function runTest() {
  const photoId = "60c72b2f9b1d8b2bad689a22";

  logger.info("Test 1: Adding a recognition job...");
  const job1 = await addRecognitionJob({ photoId });
  logger.info({ id: job1.id, data: job1.data }, "Job 1 created successfully");

  // Verify that only photoId is in the job data
  if (job1.data.photoId !== photoId || Object.keys(job1.data).length !== 1) {
    throw new Error(`Data validation failed. Expected only photoId, got: ${JSON.stringify(job1.data)}`);
  }
  logger.info("Job data verified successfully: contains only photoId.");

  logger.info("Test 2: Adding duplicate job with the same photoId...");
  const job2 = await addRecognitionJob({ photoId });
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
