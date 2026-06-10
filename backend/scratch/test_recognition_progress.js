import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { initRecognitionWorker, closeRecognitionWorker, getRecognitionWorker } from "../src/workers/recognition.worker.js";
import { addRecognitionJob } from "../src/queues/recognition.queue.js";
import Photo from "../src/models/Photo.js";
import Face from "../src/models/Face.js";
import { logger } from "../src/config/logger.js";
import redis from "../src/config/redis.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";

async function runProgressTest() {
  await connectDB();

  // Create a test photo
  const testUserId = new mongoose.Types.ObjectId();
  const testPhoto = new Photo({
    userId: testUserId,
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=400&h=400",
    cloudinaryPublicId: "test-rec-progress-public-id",
    width: 400,
    height: 400
  });
  await testPhoto.save();
  logger.info({ photoId: testPhoto._id }, "Test photo registered in DB");

  // Track progress events
  const progressCalls = [];
  const spyEmitter = {
    to(room) {
      return {
        emit(event, payload) {
          if (event === "recognition:progress") {
            progressCalls.push({ room: room.toString(), event, payload });
          }
        }
      };
    }
  };

  // Initialize worker inline with spyEmitter
  logger.info("Initializing recognition worker with spy emitter...");
  initRecognitionWorker(spyEmitter);

  const worker = getRecognitionWorker();
  
  // Wait for the job to complete
  const jobCompletedPromise = new Promise((resolve, reject) => {
    worker.on("completed", (job) => {
      if (job.data.photoId === testPhoto._id.toString()) {
        logger.info({ jobId: job.id }, "Job completed event received");
        resolve(job);
      }
    });
    worker.on("failed", (job, err) => {
      if (job && job.data && job.data.photoId === testPhoto._id.toString()) {
        reject(err);
      }
    });
  });

  // Enqueue job
  logger.info("Queueing face recognition job...");
  const job = await addRecognitionJob({ photoId: testPhoto._id });
  logger.info({ jobId: job.id }, "Job successfully queued");

  // Wait for job completion
  try {
    await jobCompletedPromise;
  } catch (err) {
    logger.error({ err }, "Job failed in worker execution");
  }

  // Assertions on progressCalls
  logger.info({ progressCalls }, "Verifying emitted progress calls...");

  // Expected 5 progress updates: 0, 25, 50, 75, 100
  if (progressCalls.length !== 5) {
    logger.error(`Expected exactly 5 progress calls, got ${progressCalls.length}`);
    process.exit(1);
  }

  const expectedProgress = [0, 25, 50, 75, 100];
  let mismatch = false;
  for (let i = 0; i < 5; i++) {
    const call = progressCalls[i];
    const expectedVal = expectedProgress[i];
    
    if (call.room !== testUserId.toString()) {
      logger.error(`Call ${i}: Room mismatch. Expected ${testUserId.toString()}, got ${call.room}`);
      mismatch = true;
    }
    
    if (call.payload.photoId !== testPhoto._id.toString()) {
      logger.error(`Call ${i}: PhotoId mismatch. Expected ${testPhoto._id}, got ${call.payload.photoId}`);
      mismatch = true;
    }

    if (call.payload.jobId !== job.id) {
      logger.error(`Call ${i}: JobId mismatch. Expected ${job.id}, got ${call.payload.jobId}`);
      mismatch = true;
    }

    if (call.payload.progress !== expectedVal) {
      logger.error(`Call ${i}: Progress mismatch. Expected ${expectedVal}, got ${call.payload.progress}`);
      mismatch = true;
    }
  }

  if (mismatch) {
    logger.error("TEST FAILED: Some progress events were incorrect.");
    process.exit(1);
  }

  logger.info("TEST SUCCESSFUL: All progress events emitted in the correct sequence (0 -> 25 -> 50 -> 75 -> 100)!");

  // Clean up
  logger.info("Closing connections and cleaning up DB records...");
  await closeRecognitionWorker();
  await Photo.deleteOne({ _id: testPhoto._id });
  await Face.deleteMany({ photoId: testPhoto._id });
  await redis.quit();
  await closeBullMQConnection();
  await mongoose.disconnect();
  
  logger.info("Clean shutdown complete.");
  process.exit(0);
}

runProgressTest().catch((err) => {
  logger.error({ err }, "Test exception occurred");
  process.exit(1);
});
