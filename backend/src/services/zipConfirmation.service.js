import redis from "../config/redis.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";

/**
 * Structured error class for ZIP confirmation flow.
 */
export class ZipConfirmationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "ZipConfirmationError";
    this.code = code || "ZIP_CONFIRMATION_ERROR";
    this.details = details;
  }
}

/**
 * Generates the Redis key for a given session ID.
 * @param {string} sessionId 
 * @returns {string}
 */
const getRedisKey = (sessionId) => `zip:confirmation:${sessionId}`;

/**
 * Creates a pending ZIP confirmation session in Redis.
 * 
 * @param {object} params
 * @param {string|object} params.userId - ID of the user requesting delivery.
 * @param {string} params.medium - Delivery medium (e.g. 'whatsapp', 'email').
 * @param {string} params.recipient - Destination of delivery.
 * @param {Array<string|object>} params.photoIds - Array of photo IDs to deliver.
 * @param {number} params.totalBytes - Combined size of photos in bytes.
 * @param {number} params.count - Total number of photos.
 * @returns {Promise<object>} Returns { sessionId, expiresAt }
 */
export async function createConfirmation({ userId, medium, recipient, photoIds, totalBytes, count }) {
  // Validate inputs
  if (!userId) {
    throw new ZipConfirmationError("userId is required", "INVALID_INPUT");
  }
  if (!medium || typeof medium !== "string") {
    throw new ZipConfirmationError("medium is required and must be a string", "INVALID_INPUT");
  }
  if (!recipient || typeof recipient !== "string") {
    throw new ZipConfirmationError("recipient is required and must be a string", "INVALID_INPUT");
  }
  if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
    throw new ZipConfirmationError("photoIds is required and must be a non-empty array", "INVALID_INPUT");
  }
  if (totalBytes === undefined || typeof totalBytes !== "number" || totalBytes < 0) {
    throw new ZipConfirmationError("totalBytes is required and must be a non-negative number", "INVALID_INPUT");
  }
  if (count === undefined || typeof count !== "number" || count < 0) {
    throw new ZipConfirmationError("count is required and must be a non-negative number", "INVALID_INPUT");
  }

  const sessionId = uuidv4();
  const ttlSeconds = env.ZIP_CONFIRMATION_TTL_SECONDS;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const payload = {
    userId: userId.toString(),
    medium,
    recipient,
    photoIds: photoIds.map(id => id.toString()),
    totalBytes,
    count,
    createdAt,
    expiresAt
  };

  const redisKey = getRedisKey(sessionId);
  try {
    await redis.set(redisKey, JSON.stringify(payload), "EX", ttlSeconds);
    logger.info({ sessionId, expiresAt }, "Created ZIP confirmation session in Redis");
    return {
      sessionId,
      expiresAt: new Date(expiresAt)
    };
  } catch (error) {
    logger.error({ error, sessionId }, "Failed to save ZIP confirmation to Redis");
    throw new ZipConfirmationError(`Failed to save confirmation: ${error.message}`, "REDIS_ERROR");
  }
}

/**
 * Atomically retrieves and deletes a pending ZIP confirmation session from Redis.
 * Checks logical expiration and throws if expired.
 * 
 * @param {string} sessionId 
 * @returns {Promise<object>} The stored delivery request payload.
 */
export async function confirmConfirmation(sessionId) {
  // Validate sessionId
  if (!sessionId || typeof sessionId !== "string" || !uuidValidate(sessionId)) {
    throw new ZipConfirmationError("Invalid session ID format", "INVALID_SESSION_ID");
  }

  const redisKey = getRedisKey(sessionId);
  let payloadStr;

  try {
    // Atomically GET and DELETE the key in a single Redis evaluation
    payloadStr = await redis.eval(
      `local val = redis.call('GET', KEYS[1])
       if val then
         redis.call('DEL', KEYS[1])
       end
       return val`,
      1,
      redisKey
    );
  } catch (error) {
    logger.error({ error, sessionId }, "Failed to atomically get and delete ZIP confirmation from Redis");
    throw new ZipConfirmationError(`Failed to confirm: ${error.message}`, "REDIS_ERROR");
  }

  if (!payloadStr) {
    throw new ZipConfirmationError("Session not found or already confirmed/expired", "SESSION_NOT_FOUND");
  }

  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch (error) {
    throw new ZipConfirmationError("Malformed session payload in Redis", "MALFORMED_PAYLOAD");
  }

  // Check logical expiration
  const now = Date.now();
  const expiresAtTime = new Date(payload.expiresAt).getTime();
  if (now > expiresAtTime) {
    logger.warn({ sessionId, expiresAt: payload.expiresAt }, "ZIP confirmation session has expired logically");
    throw new ZipConfirmationError("Confirmation session has expired", "SESSION_EXPIRED");
  }

  logger.info({ sessionId }, "ZIP confirmation session confirmed successfully");
  return payload;
}

/**
 * Cancels a pending ZIP confirmation session by deleting it from Redis (idempotently).
 * 
 * @param {string} sessionId 
 * @returns {Promise<object>} { success: true }
 */
export async function cancelConfirmation(sessionId) {
  // Validate sessionId
  if (!sessionId || typeof sessionId !== "string" || !uuidValidate(sessionId)) {
    throw new ZipConfirmationError("Invalid session ID format", "INVALID_SESSION_ID");
  }

  const redisKey = getRedisKey(sessionId);
  try {
    await redis.del(redisKey);
    logger.info({ sessionId }, "ZIP confirmation session cancelled successfully");
    return { success: true };
  } catch (error) {
    logger.error({ error, sessionId }, "Failed to cancel ZIP confirmation in Redis");
    throw new ZipConfirmationError(`Failed to cancel: ${error.message}`, "REDIS_ERROR");
  }
}
