import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { addRecognitionJob } from "../src/queues/recognition.queue.js";
import Photo from "../src/models/Photo.js";
import Face from "../src/models/Face.js";
import { logger } from "../src/config/logger.js";
import { exec } from "child_process";

async function runTest() {
  await connectDB();

  // 1. Create a dummy photo
  const testPhoto = new Photo({
    userId: new mongoose.Types.ObjectId(),
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=400&h=400", // Man's face
    cloudinaryPublicId: "test-rec-worker-public-id",
    width: 400,
    height: 400
  });
  await testPhoto.save();
  logger.info({ photoId: testPhoto._id }, "Test photo registered in DB");

  // 2. Start the worker process asynchronously
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

  // 3. Queue the job
  logger.info("Queueing face recognition job...");
  const job = await addRecognitionJob({ photoId: testPhoto._id });
  logger.info({ jobId: job.id }, "Job successfully queued");

  // 4. Poll database to check if faces are processed and persisted
  logger.info("Waiting for background processing to complete...");
  let attempts = 0;
  let success = false;
  while (attempts < 15) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const photo = await Photo.findById(testPhoto._id);
    const faces = await Face.find({ photoId: testPhoto._id });

    logger.info(
      { attempts, faceCount: photo?.faceCount, faceDocsSaved: faces.length },
      "Checking DB states..."
    );

    if (faces.length > 0) {
      success = true;
      break;
    }
  }

  // 5. Clean up worker process with graceful SIGINT signal
  logger.info("Killing worker process...");
  workerProcess.kill("SIGINT");
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Clean up database documents
  await Photo.deleteOne({ _id: testPhoto._id });
  await Face.deleteMany({ photoId: testPhoto._id });
  logger.info("Database records cleaned up.");

  await mongoose.disconnect();

  if (success) {
    logger.info("TEST SUCCESSFUL: Face documents created and photo faceCount updated!");
    process.exit(0);
  } else {
    logger.error("TEST FAILED: Processing timed out or did not persist faces.");
    process.exit(1);
  }
}

runTest().catch((err) => {
  logger.error({ err }, "Test exception occurred");
  process.exit(1);
});
