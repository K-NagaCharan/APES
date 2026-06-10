import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { initRecognitionWorker, closeRecognitionWorker, getRecognitionWorker } from "../src/workers/recognition.worker.js";
import { addRecognitionJob } from "../src/queues/recognition.queue.js";
import Photo from "../src/models/Photo.js";
import Face from "../src/models/Face.js";
import Person from "../src/models/Person.js";
import { logger } from "../src/config/logger.js";
import redis from "../src/config/redis.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";
import * as faceRecognitionService from "../src/services/faceRecognition.service.js";

async function runRecognitionDoneTest() {
  await connectDB();

  const testUserId = new mongoose.Types.ObjectId();

  // Create a test Person with a centroid
  const normalizedVector = new Array(512).fill(0);
  normalizedVector[0] = 1;

  const testPerson = new Person({
    name: "Test Person A",
    nameNormalized: "test person a",
    userId: testUserId,
    centroid: normalizedVector,
    centroidCount: 1
  });
  await testPerson.save();
  logger.info({ personId: testPerson._id }, "Test Person registered in DB");

  // Create a test photo
  const testPhoto = new Photo({
    userId: testUserId,
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=400&h=400",
    cloudinaryPublicId: "test-rec-done-public-id",
    width: 400,
    height: 400
  });
  await testPhoto.save();
  logger.info({ photoId: testPhoto._id }, "Test photo registered in DB");

  // Stub Axios adapter to return two faces:
  // 1. One face matching the centroid vector
  // 2. One face orthogonal to the centroid vector
  const originalAdapter = faceRecognitionService.client.defaults.adapter;
  faceRecognitionService.client.defaults.adapter = async (config) => {
    const matchedEmbedding = new Array(512).fill(0);
    matchedEmbedding[0] = 1;

    const unknownEmbedding = new Array(512).fill(0);
    unknownEmbedding[1] = 1;

    return {
      status: 200,
      statusText: "OK",
      headers: {},
      config,
      data: {
        faces: [
          {
            bbox: { x: 15, y: 15, w: 45, h: 45 },
            embedding: matchedEmbedding
          },
          {
            bbox: { x: 120, y: 120, w: 55, h: 55 },
            embedding: unknownEmbedding
          }
        ]
      }
    };
  };

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

  // Initialize recognition worker with spyEmitter
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

  // Restore Axios adapter
  faceRecognitionService.client.defaults.adapter = originalAdapter;

  // Assertions on emitted events
  logger.info({ emittedEvents }, "Verifying emitted socket events...");

  // Filter for face:new and recognition:done
  const faceNewEvents = emittedEvents.filter(e => e.event === "face:new");
  const recDoneEvents = emittedEvents.filter(e => e.event === "recognition:done");

  // Assertions
  if (faceNewEvents.length !== 1) {
    logger.error(`Expected exactly 1 face:new event, got ${faceNewEvents.length}`);
    process.exit(1);
  }

  if (recDoneEvents.length !== 1) {
    logger.error(`Expected exactly 1 recognition:done event, got ${recDoneEvents.length}`);
    process.exit(1);
  }

  const faceNewIndex = emittedEvents.indexOf(faceNewEvents[0]);
  const recDoneIndex = emittedEvents.indexOf(recDoneEvents[0]);

  // Ordering validation: face:new must be emitted before recognition:done
  if (faceNewIndex > recDoneIndex) {
    logger.error(`Ordering mismatch: face:new (idx: ${faceNewIndex}) was emitted AFTER recognition:done (idx: ${recDoneIndex})`);
    process.exit(1);
  } else {
    logger.info("Sequence validation SUCCESS: face:new was emitted before recognition:done!");
  }

  // Done payload validation
  const donePayload = recDoneEvents[0].payload;
  logger.info({ donePayload }, "Checking recognition:done payload values");

  if (donePayload.success !== true) {
    logger.error("Payload mismatch: success should be true");
    process.exit(1);
  }

  if (donePayload.jobId !== job.id) {
    logger.error(`Payload mismatch: jobId expected ${job.id}, got ${donePayload.jobId}`);
    process.exit(1);
  }

  if (donePayload.photoId !== testPhoto._id.toString()) {
    logger.error(`Payload mismatch: photoId expected ${testPhoto._id}, got ${donePayload.photoId}`);
    process.exit(1);
  }

  if (donePayload.totalFaces !== 2) {
    logger.error(`Payload mismatch: totalFaces expected 2, got ${donePayload.totalFaces}`);
    process.exit(1);
  }

  if (donePayload.matchedFaces !== 1) {
    logger.error(`Payload mismatch: matchedFaces expected 1, got ${donePayload.matchedFaces}`);
    process.exit(1);
  }

  if (donePayload.unknownFaces !== 1) {
    logger.error(`Payload mismatch: unknownFaces expected 1, got ${donePayload.unknownFaces}`);
    process.exit(1);
  }

  logger.info("TEST SUCCESSFUL: recognition:done was emitted after face:new with the correct summary metrics and success: true payload!");

  // Clean up
  logger.info("Closing connections and cleaning up DB records...");
  await closeRecognitionWorker();
  await Photo.deleteOne({ _id: testPhoto._id });
  await Face.deleteMany({ photoId: testPhoto._id });
  await Person.deleteOne({ _id: testPerson._id });
  await redis.quit();
  await closeBullMQConnection();
  await mongoose.disconnect();
  
  logger.info("Clean shutdown complete.");
  process.exit(0);
}

runRecognitionDoneTest().catch((err) => {
  logger.error({ err }, "Test exception occurred");
  process.exit(1);
});
