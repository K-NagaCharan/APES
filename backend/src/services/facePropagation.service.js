import Face from "../models/Face.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";
import { AuthorizationError, NotFoundError } from "../utils/errors.js";

// Initialize THRESHOLD once at module load time to keep logic clean and performant
const THRESHOLD = env.FACE_MATCH_THRESHOLD;

/**
 * propagateFaceLabel
 * Scans other unlabeled faces belonging to the same user, computes their similarity
 * against the newly labeled face's embedding, and bulk-updates similar faces to link them
 * to the same Person.
 * 
 * @param {string|object} faceId - Newly labeled face ObjectID.
 * @param {string|object} personId - Person ObjectID to propagate.
 * @param {string|object} userId - ObjectID of the active user (tenant scope).
 * @returns {Promise<object>} Propagation metrics { checked, propagated }
 * @throws {Error} If face is not found or user tenancy checks fail.
 */
export async function propagateFaceLabel(faceId, personId, userId) {
  const startTime = Date.now();

  // 1. Retrieve the newly labeled Face document by its faceId
  const face = await Face.findById(faceId);
  if (!face) {
    throw new NotFoundError("Face not found");
  }

  // 2. Verify user tenancy ownership
  if (face.userId.toString() !== userId.toString()) {
    throw new AuthorizationError("Access denied. You do not own this face.");
  }

  const labeledEmbedding = face.embedding;

  // 3. Load all candidate unlabeled faces for this user, explicitly excluding the current face
  // The originating labeled face must never be updated during propagation.
  const query = {
    userId,
    isLabeled: false,
    _id: { $ne: faceId }
  };

  // Performance Optimization: select only _id and embedding fields, and use lean()
  const candidates = await Face.find(query)
    .select("_id embedding")
    .lean();

  let checked = 0;
  const matchingIds = [];

  if (candidates.length === 0) {
    logger.info(
      {
        faceId,
        personId,
        checked: 0,
        propagated: 0,
        durationMs: Date.now() - startTime
      },
      "Face label propagation completed: no candidate unlabeled faces found"
    );
    return {
      checked: 0,
      propagated: 0
    };
  }

  // 4. Linear compare loop
  // Future optimization:
  // Compare embeddings in batches to reduce memory consumption.
  for (const candidate of candidates) {
    const candidateEmbedding = candidate.embedding;

    // Validate embedding dimensions before comparison
    if (
      !labeledEmbedding ||
      !candidateEmbedding ||
      labeledEmbedding.length !== 512 ||
      candidateEmbedding.length !== 512
    ) {
      logger.warn(
        {
          faceId,
          candidateId: candidate._id,
          labeledLength: labeledEmbedding ? labeledEmbedding.length : null,
          candidateLength: candidateEmbedding ? candidateEmbedding.length : null
        },
        "Invalid face embedding dimensions. Skipping candidate face."
      );
      continue;
    }

    checked++;

    try {
      const similarity = cosineSimilarity(labeledEmbedding, candidateEmbedding);
      if (similarity >= THRESHOLD) {
        matchingIds.push(candidate._id);
      }
    } catch (err) {
      logger.warn(
        { candidateId: candidate._id, err: err.message },
        "Failed comparing candidate embedding, skipping item"
      );
    }
  }

  let propagated = 0;

  // 5. Perform bulk update using updateMany
  if (matchingIds.length > 0) {
    // Future: Wrap updateMany inside a MongoDB transaction session once transactional uploads are set up.
    const result = await Face.updateMany(
      { _id: { $in: matchingIds } },
      { $set: { personId, isLabeled: true } }
    );
    propagated = result.modifiedCount;
  }

  const durationMs = Date.now() - startTime;

  // 6. Logging metadata (excluding embedding vectors)
  logger.info(
    {
      faceId,
      personId,
      checked,
      propagated,
      durationMs
    },
    "Face label propagation successfully completed"
  );

  // Future optimization:
  // Replace linear scan with vector search (Qdrant / pgvector / Pinecone)
  // when embedding count becomes large.

  return {
    checked,
    propagated
  };
}
