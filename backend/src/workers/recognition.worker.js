import { Worker } from "bullmq";
import { bullMQConnection } from "../config/bullmq.js";
import { logger } from "../config/logger.js";
import Photo from "../models/Photo.js";
import { recognizeFaces } from "../services/faceRecognition.service.js";
import { processRecognizedFaces } from "../services/facePersistence.service.js";
import { emitRecognitionProgress, emitFaceNew, emitRecognitionDone } from "../socket/events.js";

const WORKER_NAME = "recognitionQueue";

let recognitionWorker = null;
let socketEmitter = null;

/**
 * Initializes the face recognition worker with an optional socket emitter.
 * @param {object} emitter - Socket.io instance or custom emitter abstraction
 * @returns {object} - BullMQ Worker instance
 */
export const initRecognitionWorker = (emitter) => {
  if (recognitionWorker) {
    return recognitionWorker;
  }

  socketEmitter = emitter;

  recognitionWorker = new Worker(
    WORKER_NAME,
    async (job) => {
      const { photoId } = job.data;
      logger.info({ jobId: job.id, photoId }, "Face recognition worker job started");

      const photo = await Photo.findById(photoId);
      if (!photo) {
        const errorMsg = `Photo not found for photoId: ${photoId}`;
        logger.error({ jobId: job.id, photoId }, errorMsg);
        throw new Error(errorMsg);
      }

      // Helper to emit progress updates safely
      const reportProgress = (progress) => {
        if (!socketEmitter) return;
        try {
          emitRecognitionProgress(socketEmitter, photo.userId, {
            photoId: photo._id.toString(),
            jobId: job.id,
            progress
          });
        } catch (emitError) {
          logger.warn(
            { photoId: photo._id, progress, err: emitError.message },
            "Failed to emit recognition progress"
          );
        }
      };

      // 0% (Start): Job started & payload loaded
      reportProgress(0);

      try {
        // Use standard Photo.imageUrl virtual property
        const imageUrl = photo.imageUrl;
        if (!imageUrl) {
          throw new Error(`imageUrl is missing on photo document: ${photoId}`);
        }

        // 25% (Ready): Image URL retrieved & ready for analysis
        reportProgress(25);

        logger.info({ jobId: job.id, photoId, imageUrl }, "Invoking face recognition service");
        const recognitionResult = await recognizeFaces(imageUrl);
        
        const faces = recognitionResult?.faces || [];
        
        // 50% (Analyzed): Image analysis (face detection) completed
        reportProgress(50);

        logger.info({ jobId: job.id, photoId, facesDetected: faces.length }, "Persisting face recognition outcomes");

        // Reuse existing persistence logic to save faces and match centroids
        const summary = await processRecognizedFaces(photo._id, faces);

        // 75% (Processed): Face data persistence completed
        reportProgress(75);

        // Emit face:new for each newly created unknown face
        if (summary.createdUnknownFaces && Array.isArray(summary.createdUnknownFaces)) {
          for (const faceDoc of summary.createdUnknownFaces) {
            try {
              if (socketEmitter) {
                emitFaceNew(socketEmitter, photo.userId, {
                  faceId: faceDoc._id.toString(),
                  photoId: photo._id.toString(),
                  bbox: faceDoc.bbox,
                  jobId: job.id
                });
              }
            } catch (emitError) {
              logger.warn(
                { faceId: faceDoc._id, err: emitError.message },
                "Failed to emit face:new event"
              );
            }
          }
        }

        // Save processed face count on the photo metadata (stateless: does NOT update status)
        photo.faceCount = summary.processed;
        await photo.save();

        // 100% (Completed): Entire recognition pipeline completed successfully
        reportProgress(100);

        // Emit recognition:done event
        try {
          if (socketEmitter) {
            emitRecognitionDone(socketEmitter, photo.userId, {
              success: true,
              jobId: job.id,
              photoId: photo._id.toString(),
              totalFaces: summary.processed,
              matchedFaces: summary.matched,
              unknownFaces: summary.unknown
            });
          }
        } catch (emitError) {
          logger.warn(
            { photoId: photo._id, err: emitError.message },
            "Failed to emit recognition:done event"
          );
        }

        logger.info(
          { jobId: job.id, photoId, faceCount: photo.faceCount },
          "Face recognition worker job completed successfully"
        );

        return {
          photoId,
          faceCount: photo.faceCount,
          facesDetectedCount: faces.length
        };
      } catch (err) {
        logger.error(
          { jobId: job.id, photoId, err: err.message },
          "Face recognition worker job processing error occurred"
        );
        // Rethrow to let BullMQ queue retry policies handle the recovery
        throw err;
      }
    },
    {
      connection: bullMQConnection,
      concurrency: parseInt(process.env.RECOGNITION_WORKER_CONCURRENCY || "1", 10)
    }
  );

  // Worker lifecycle event telemetry
  recognitionWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "Face recognition worker job failed permanently");
  });

  recognitionWorker.on("error", (err) => {
    logger.error({ err: err.message }, "Face recognition worker encountered connection or operational error");
  });

  return recognitionWorker;
};

/**
 * Returns the active recognition worker instance (or null if not initialized).
 * @returns {object|null}
 */
export const getRecognitionWorker = () => recognitionWorker;

/**
 * Gracefully shuts down the face recognition worker.
 * @returns {Promise<void>}
 */
export async function closeRecognitionWorker() {
  if (!recognitionWorker || recognitionWorker.status === "closed") {
    return;
  }
  try {
    await recognitionWorker.close();
    logger.info("Face recognition worker disconnected gracefully.");
  } catch (err) {
    logger.error({ err }, "Error shutting down face recognition worker");
  }
}
