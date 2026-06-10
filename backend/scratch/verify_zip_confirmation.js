import redis from "../src/config/redis.js";
import {
  createConfirmation,
  confirmConfirmation,
  cancelConfirmation,
  ZipConfirmationError
} from "../src/services/zipConfirmation.service.js";
import { logger } from "../src/config/logger.js";
import { env } from "../src/config/env.js";

const assert = (condition, message) => {
  if (!condition) {
    logger.error(`Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
};

async function runTests() {
  logger.info("Starting ZIP confirmation flow tests...");

  const testParams = {
    userId: "test-user-123",
    medium: "whatsapp",
    recipient: "+1234567890",
    photoIds: ["photo-1", "photo-2"],
    totalBytes: 5000000,
    count: 2
  };

  try {
    // ----------------------------------------------------
    // Scenario 1: Create Session
    // ----------------------------------------------------
    logger.info("--- Scenario 1: Create Confirmation Session ---");
    const result = await createConfirmation(testParams);
    assert(result.sessionId && typeof result.sessionId === "string", "sessionId must be a string");
    assert(result.expiresAt instanceof Date, "expiresAt must be a Date object");
    assert(result.expiresAt.getTime() > Date.now(), "expiresAt must be in the future");

    // Let's directly check Redis to ensure data is correct
    const stored = await redis.get(`zip:confirmation:${result.sessionId}`);
    assert(stored, "Session data must exist in Redis");
    const parsed = JSON.parse(stored);
    assert(parsed.userId === testParams.userId, "Stored userId must match");
    assert(parsed.medium === testParams.medium, "Stored medium must match");
    assert(parsed.recipient === testParams.recipient, "Stored recipient must match");
    assert(parsed.photoIds.length === 2, "Stored photoIds count must match");
    assert(parsed.totalBytes === testParams.totalBytes, "Stored totalBytes must match");
    assert(parsed.count === testParams.count, "Stored count must match");
    logger.info("Scenario 1 passed.");

    // ----------------------------------------------------
    // Scenario 2: Confirm Session (Atomic / Single Use)
    // ----------------------------------------------------
    logger.info("--- Scenario 2: Confirm Session & Single Use Atomic Deletion ---");
    const confirmedData = await confirmConfirmation(result.sessionId);
    assert(confirmedData.userId === testParams.userId, "Confirmed data userId must match");
    assert(confirmedData.totalBytes === testParams.totalBytes, "Confirmed data totalBytes must match");

    // Key should be deleted from Redis
    const checkDeleted = await redis.get(`zip:confirmation:${result.sessionId}`);
    assert(!checkDeleted, "Key must be deleted after confirmation");

    // Calling confirmation again on the same ID should throw SESSION_NOT_FOUND
    try {
      await confirmConfirmation(result.sessionId);
      assert(false, "Should have thrown SESSION_NOT_FOUND on duplicate confirmation");
    } catch (err) {
      assert(err instanceof ZipConfirmationError, "Should throw ZipConfirmationError");
      assert(err.code === "SESSION_NOT_FOUND", `Expected code SESSION_NOT_FOUND, got ${err.code}`);
    }
    logger.info("Scenario 2 passed.");

    // ----------------------------------------------------
    // Scenario 3: Cancel Session (Idempotent)
    // ----------------------------------------------------
    logger.info("--- Scenario 3: Cancel Session (Idempotent) ---");
    const cancelRes = await createConfirmation(testParams);
    const cancelResult1 = await cancelConfirmation(cancelRes.sessionId);
    assert(cancelResult1.success === true, "Cancel must return success: true");

    const checkCanceled = await redis.get(`zip:confirmation:${cancelRes.sessionId}`);
    assert(!checkCanceled, "Key must be deleted after cancel");

    // Calling cancel again on the same ID should be idempotent and return success without throwing
    const cancelResult2 = await cancelConfirmation(cancelRes.sessionId);
    assert(cancelResult2.success === true, "Subsequent cancel must still return success: true");
    logger.info("Scenario 3 passed.");

    // ----------------------------------------------------
    // Scenario 4: Invalid Session ID
    // ----------------------------------------------------
    logger.info("--- Scenario 4: Invalid Session ID ---");
    const invalidIds = ["not-a-uuid", "", null, undefined, 12345];
    for (const invalidId of invalidIds) {
      try {
        await confirmConfirmation(invalidId);
        assert(false, `Should have failed confirm for ID: ${invalidId}`);
      } catch (err) {
        assert(err instanceof ZipConfirmationError, "Should throw ZipConfirmationError");
        assert(err.code === "INVALID_SESSION_ID", `Expected INVALID_SESSION_ID for ${invalidId}, got ${err.code}`);
      }

      try {
        await cancelConfirmation(invalidId);
        assert(false, `Should have failed cancel for ID: ${invalidId}`);
      } catch (err) {
        assert(err instanceof ZipConfirmationError, "Should throw ZipConfirmationError");
        assert(err.code === "INVALID_SESSION_ID", `Expected INVALID_SESSION_ID for ${invalidId}, got ${err.code}`);
      }
    }
    logger.info("Scenario 4 passed.");

    // ----------------------------------------------------
    // Scenario 5: Logically Expired Session
    // ----------------------------------------------------
    logger.info("--- Scenario 5: Logically Expired Session ---");
    // Generate a valid session first
    const expiredRes = await createConfirmation(testParams);
    const expiredSessionId = expiredRes.sessionId;
    const expiredPayload = {
      ...testParams,
      createdAt: new Date(Date.now() - 20000).toISOString(),
      expiresAt: new Date(Date.now() - 10000).toISOString() // 10 seconds in the past
    };
    await redis.set(`zip:confirmation:${expiredSessionId}`, JSON.stringify(expiredPayload), "EX", 300);

    try {
      await confirmConfirmation(expiredSessionId);
      assert(false, "Should have thrown SESSION_EXPIRED");
    } catch (err) {
      assert(err instanceof ZipConfirmationError, "Should throw ZipConfirmationError");
      assert(err.code === "SESSION_EXPIRED", `Expected SESSION_EXPIRED, got ${err.code}`);
    }

    // Key should have been deleted by the confirmConfirmation function when it encountered the expired check
    const checkExpiredKeyDeleted = await redis.get(`zip:confirmation:${expiredSessionId}`);
    assert(!checkExpiredKeyDeleted, "Key must be deleted after expired confirm attempt");
    logger.info("Scenario 5 passed.");

    // ----------------------------------------------------
    // Scenario 6: Automatic TTL Expiration
    // ----------------------------------------------------
    logger.info("--- Scenario 6: Automatic TTL Expiration ---");
    // Temporarily set TTL to 1 second
    const originalTtl = env.ZIP_CONFIRMATION_TTL_SECONDS;
    env.ZIP_CONFIRMATION_TTL_SECONDS = 1;

    const ttlRes = await createConfirmation(testParams);
    logger.info("Waiting 1.5 seconds for Redis TTL eviction...");
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Confirm should now throw SESSION_NOT_FOUND since Redis automatically deleted the key
    try {
      await confirmConfirmation(ttlRes.sessionId);
      assert(false, "Should have thrown SESSION_NOT_FOUND due to TTL eviction");
    } catch (err) {
      assert(err instanceof ZipConfirmationError, "Should throw ZipConfirmationError");
      assert(err.code === "SESSION_NOT_FOUND", `Expected SESSION_NOT_FOUND, got ${err.code}`);
    }

    // Restore TTL
    env.ZIP_CONFIRMATION_TTL_SECONDS = originalTtl;
    logger.info("Scenario 6 passed.");

    logger.info("ALL SCENARIOS COMPLETED SUCCESSFULLY!");
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, "Tests encountered a critical error");
    throw err;
  } finally {
    // Disconnect Redis so the script exits cleanly
    await redis.quit();
    logger.info("Redis connection closed.");
  }
}

runTests().catch((err) => {
  logger.error("Test execution failed");
  process.exit(1);
});
