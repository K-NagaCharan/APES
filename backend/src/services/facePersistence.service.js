import Photo from "../models/Photo.js";
import Face from "../models/Face.js";
import { findBestFaceMatch } from "./faceMatching.service.js";
import { logger } from "../config/logger.js";

/**
 * processRecognizedFaces
 * Processes recognized faces from the Python microservice for a given photo.
 * Matches them against existing people, and persists them in bulk into MongoDB.
 * 
 * @param {string|object} photoId - Parent MongoDB Photo ObjectID
 * @param {object[]} recognizedFaces - Array of recognized face items { bbox: {x,y,w,h}, embedding: [512 floats] }
 * @returns {Promise<object>} Summary of processing outcome
 * @throws {Error} If Photo does not exist, or if faces have already been processed for this Photo
 */
export async function processRecognizedFaces(photoId, recognizedFaces) {
  const startTime = Date.now();

  // 1. Retrieve the corresponding Photo to check tenancy and owner
  const photo = await Photo.findById(photoId).select("userId");
  if (!photo) {
    throw new Error("Photo not found");
  }

  // 2. Idempotency Check: Prevent duplicate processing for the same photoId
  const existingFaces = await Face.countDocuments({ photoId });
  if (existingFaces > 0) {
    throw new Error("Faces already processed for this photo");
  }

  const userId = photo.userId;
  let processed = 0;
  let matched = 0;
  let unknown = 0;
  const unknownDocIndices = [];
  const docs = [];

  // 3. Loop through and evaluate each face representation
  for (const face of recognizedFaces) {
    const { embedding, bbox } = face;

    // Validate embedding length
    if (!embedding || !Array.isArray(embedding) || embedding.length !== 512) {
      logger.warn(
        { photoId, embeddingLength: embedding ? embedding.length : null },
        "Invalid embedding dimension, skipping face"
      );
      continue;
    }

    // Validate bounding box coordinates and dimensions
    if (
      !bbox || 
      typeof bbox.x !== "number" ||
      typeof bbox.y !== "number" ||
      typeof bbox.w !== "number" || 
      typeof bbox.h !== "number" || 
      bbox.w <= 0 || 
      bbox.h <= 0
    ) {
      logger.warn(
        { photoId, bbox },
        "Invalid bounding box dimensions, skipping face"
      );
      continue;
    }

    processed++;

    // Execute matching against stored labeled embeddings for this specific user
    const matchResult = await findBestFaceMatch(embedding, userId);

    if (matchResult.matched) {
      matched++;
      docs.push({
        photoId,
        personId: matchResult.personId,
        userId,
        embedding,
        bbox: {
          x: bbox.x,
          y: bbox.y,
          w: bbox.w,
          h: bbox.h
        },
        isLabeled: true
      });
    } else {
      unknown++;
      unknownDocIndices.push(docs.length);
      docs.push({
        photoId,
        personId: null,
        userId,
        embedding,
        bbox: {
          x: bbox.x,
          y: bbox.y,
          w: bbox.w,
          h: bbox.h
        },
        isLabeled: false
      });
    }
  }

  // 4. Perform bulk insert (insertMany) for performance optimization
  let savedDocs = [];
  if (docs.length > 0) {
    // Future:
    // Wrap insertMany inside a MongoDB transaction session
    // when the upload pipeline becomes transactional.
    savedDocs = await Face.insertMany(docs);
  }

  // Map indices of inserted unknown faces to their saved database documents
  const createdUnknownFaces = unknownDocIndices.map((index) => savedDocs[index]);

  const durationMs = Date.now() - startTime;

  // 5. Log execution metrics (no embeddings logged)
  logger.info(
    {
      photoId,
      processed,
      matched,
      unknown,
      durationMs
    },
    "Face recognition persistence pipeline completed"
  );

  return {
    processed,
    matched,
    unknown,
    faceIds: savedDocs.map((d) => d._id),
    createdUnknownFaces
  };
}
