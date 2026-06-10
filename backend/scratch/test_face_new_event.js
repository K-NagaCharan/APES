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

async function runFaceNewTest() {
  await connectDB();

  const testUserId = new mongoose.Types.ObjectId();

  // Create a test Person with a centroid
  // A L2-normalized vector where first element is 1 and all others are 0
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
    cloudinaryPublicId: "test-rec-facenew-public-id",
    width: 400,
    height: 400
  });
  await testPhoto.save();
  logger.info({ photoId: testPhoto._id }, "Test photo registered in DB");

  // Stub Axios adapter to return two faces:
  // 1. One face matching the centroid vector (first element 1, rest 0)
  // 2. One face orthogonal to the centroid vector (second element 1, rest 0) -> this is the unknown face
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
            bbox: { x: 10, y: 10, w: 50, h: 50 },
            embedding: matchedEmbedding
          },
          {
            bbox: { x: 100, y: 100, w: 60, h: 60 },
            embedding: unknownEmbedding
          }
        ]
      }
    };
  };

  // Track face:new events
  const faceNewCalls = [];
  const spyEmitter = {
    to(room) {
      return {
        emit(event, payload) {
          if (event === "face:new") {
            faceNewCalls.push({ room: room.toString(), event, payload });
          }
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

  // Restore the original Axios adapter
  faceRecognitionService.client.defaults.adapter = originalAdapter;

  // Assertions on faceNewCalls
  logger.info({ faceNewCalls }, "Verifying emitted face:new calls...");

  // Expected exactly 1 call (for the unknown face, since the other face is matched to testPerson)
  if (faceNewCalls.length !== 1) {
    logger.error(`Expected exactly 1 face:new call, got ${faceNewCalls.length}`);
    process.exit(1);
  }

  const call = faceNewCalls[0];
  if (call.room !== testUserId.toString()) {
    logger.error(`Room mismatch. Expected ${testUserId.toString()}, got ${call.room}`);
    process.exit(1);
  }

  if (call.payload.photoId !== testPhoto._id.toString()) {
    logger.error(`PhotoId mismatch. Expected ${testPhoto._id}, got ${call.payload.photoId}`);
    process.exit(1);
  }

  if (call.payload.jobId !== job.id) {
    logger.error(`JobId mismatch. Expected ${job.id}, got ${call.payload.jobId}`);
    process.exit(1);
  }

  if (typeof call.payload.faceId !== "string" || call.payload.faceId.length === 0) {
    logger.error("FaceId is missing or invalid in payload");
    process.exit(1);
  }

  if (call.payload.bbox.x !== 100 || call.payload.bbox.w !== 60) {
    logger.error(`Bbox mismatch. Expected x=100 w=60, got x=${call.payload.bbox.x} w=${call.payload.bbox.w}`);
    process.exit(1);
  }

  logger.info("TEST SUCCESSFUL: Exactly one face:new event was emitted with the correct payload for the newly created unknown face!");

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

runFaceNewTest().catch((err) => {
  logger.error({ err }, "Test exception occurred");
  process.exit(1);
});
