import { addDeliveryJob } from "../src/queues/delivery.queue.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";
import { logger } from "../src/config/logger.js";
import { exec } from "child_process";

async function runTest() {
  const requestId = "test-delivery-req-123456";

  // 1. Start the worker process asynchronously
  logger.info("Starting worker process...");
  const workerProcess = exec("node worker.js", { cwd: process.cwd() });

  workerProcess.stdout.on("data", (data) => {
    logger.info(`[WORKER OUT] ${data.trim()}`);
  });

  workerProcess.stderr.on("data", (data) => {
    logger.error(`[WORKER ERR] ${data.trim()}`);
  });

  // Wait 4 seconds for worker process to fully boot and connect to Redis
  await new Promise((resolve) => setTimeout(resolve, 4000));

  // 2. Queue the delivery job
  logger.info("Queueing delivery job...");
  const job = await addDeliveryJob({ requestId });
  logger.info({ jobId: job.id }, "Job successfully queued");

  // 3. Wait for background processing to complete (mock takes 1.5s, so we wait 4s)
  logger.info("Waiting for background delivery processing...");
  await new Promise((resolve) => setTimeout(resolve, 4000));

  // 4. Kill worker process with graceful SIGINT signal
  logger.info("Killing worker process...");
  workerProcess.kill("SIGINT");
  await new Promise((resolve) => setTimeout(resolve, 1500));

  await closeBullMQConnection();
  
  logger.info("TEST COMPLETE: Verify output logs to confirm successful connection, processing, and graceful shutdown.");
  process.exit(0);
}

runTest().catch(async (err) => {
  logger.error({ err }, "Test exception occurred");
  await closeBullMQConnection();
  process.exit(1);
});
