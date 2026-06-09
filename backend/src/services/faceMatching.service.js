import Face from "../models/Face.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";

// Initialize THRESHOLD once at module load time to keep logic clean and performant
const THRESHOLD = env.FACE_MATCH_THRESHOLD;

/**
 * findBestFaceMatch
 * Compares an input 512-dimension face embedding against all stored, labeled face embeddings
 * in MongoDB using cosine similarity to identify a matched person.
 * 
 * @param {number[]} embedding - 512-dimensional array of numbers
 * @param {string|null} userId - Optional user ID to scope search
 * @returns {Promise<object>} Match result metadata
 * @throws {Error|TypeError} If embedding is malformed, not an array, or has invalid dimensions
 */
export async function findBestFaceMatch(embedding, userId = null) {
  const startTime = Date.now();

  // 1. Enforce dimension constraints in application/business logic layer
  if (!Array.isArray(embedding) || embedding.length !== 512) {
    throw new Error("Input embedding must be an array of exactly 512 numbers");
  }

  for (let i = 0; i < embedding.length; i++) {
    const val = embedding[i];
    if (typeof val !== "number" || Number.isNaN(val)) {
      throw new TypeError("Embedding elements must be valid numbers");
    }
  }

  // 2. Query MongoDB for labeled face entries (personId is not null)
  const query = { personId: { $ne: null } };
  if (userId) {
    query.userId = userId;
  }

  // Performance Optimization: select only _id, personId, and embedding fields and lean()
  const storedFaces = await Face.find(query)
    .select("_id personId embedding")
    .lean();

  const durationMs = Date.now() - startTime;

  // 3. Graceful handling of empty database check
  if (storedFaces.length === 0) {
    logger.info(
      {
        compared: 0,
        bestScore: null,
        matched: false,
        durationMs
      },
      "Face matching completed: no labeled faces found in database"
    );
    return {
      matched: false,
      score: null
    };
  }

  let bestMatch = null;
  let bestScore = -1.0;

  // 4. Perform linear compare loop
  for (const storedFace of storedFaces) {
    try {
      const similarity = cosineSimilarity(embedding, storedFace.embedding);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = storedFace;
      }
    } catch (err) {
      logger.warn(
        { faceId: storedFace._id, err: err.message },
        "Failed comparing against stored face embedding, skipping item"
      );
    }
  }

  const isMatch = bestScore >= THRESHOLD;
  const finalDurationMs = Date.now() - startTime;

  // 5. Logging metadata (no raw vectors)
  logger.info(
    {
      compared: storedFaces.length,
      bestScore: parseFloat(bestScore.toFixed(4)),
      matched: isMatch,
      durationMs: finalDurationMs
    },
    "Face matching calculation complete"
  );

  // Future optimization:
  // Replace full-scan in-memory comparisons with a dedicated vector database (e.g. Qdrant)
  // once the number of stored face documents grows beyond practical limits (e.g., >50,000 faces).

  if (isMatch && bestMatch) {
    return {
      matched: true,
      faceId: bestMatch._id,
      personId: bestMatch.personId,
      score: bestScore
    };
  }

  return {
    matched: false,
    score: bestScore
  };
}
