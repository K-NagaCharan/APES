import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { logDelivery } from "../src/services/delivery.service.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";
import { logger } from "../src/config/logger.js";

const assert = (condition, message) => {
  if (!condition) {
    logger.error(`Assertion Failed: ${message}`);
    process.exit(1);
  }
};

const assertThrows = async (fn, expectedErrorSnippet) => {
  try {
    await fn();
    logger.error(`Assertion Failed: Expected error containing "${expectedErrorSnippet}" but function succeeded.`);
    process.exit(1);
  } catch (err) {
    if (!err.message.includes(expectedErrorSnippet)) {
      logger.error(`Assertion Failed: Expected error containing "${expectedErrorSnippet}", got: "${err.message}"`);
      process.exit(1);
    }
    logger.info(`Caught expected error: "${err.message}"`);
  }
};

async function runTests() {
  logger.info("Initializing DB connection...");
  await connectDB();

  const testUserId = new mongoose.Types.ObjectId();
  const testPhotoIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

  try {
    // ----------------------------------------------------
    // Scenario 1: Valid delivery log with all inputs
    // ----------------------------------------------------
    logger.info("--- Scenario 1: Valid delivery log with all inputs ---");
    const record1 = await logDelivery({
      userId: testUserId,
      medium: "email",
      recipient: "test@example.com",
      photoIds: testPhotoIds,
      count: 2,
      format: "zip",
      zipUrl: "https://cloudinary.com/zip",
      cloudinaryPublicId: "cloudinary_zip_123"
    });

    assert(record1._id !== undefined, "Record 1 should have an _id");
    assert(record1.userId.toString() === testUserId.toString(), "Record 1 userId should match");
    assert(record1.medium === "email", "Record 1 medium should be email");
    assert(record1.recipient === "test@example.com", "Record 1 recipient should match");
    assert(record1.photoIds.length === 2, "Record 1 photoIds length should be 2");
    assert(record1.count === 2, "Record 1 count should be 2");
    assert(record1.format === "zip", "Record 1 format should be zip");
    assert(record1.zipUrl === "https://cloudinary.com/zip", "Record 1 zipUrl should match");
    assert(record1.cloudinaryPublicId === "cloudinary_zip_123", "Record 1 cloudinaryPublicId should match");
    assert(record1.status === "queued", "Record 1 status should default to queued");
    logger.info("Scenario 1 PASSED.");

    // ----------------------------------------------------
    // Scenario 2: Valid delivery log with omitted count (defaults to photoIds.length)
    // ----------------------------------------------------
    logger.info("--- Scenario 2: Valid delivery log with omitted count ---");
    const record2 = await logDelivery({
      userId: testUserId,
      medium: "whatsapp",
      recipient: "+123456789",
      photoIds: testPhotoIds,
      format: "links"
    });

    assert(record2._id !== undefined, "Record 2 should have an _id");
    assert(record2.count === testPhotoIds.length, `Record 2 count should auto-default to ${testPhotoIds.length}, got ${record2.count}`);
    assert(record2.format === "links", "Record 2 format should be links");
    assert(record2.zipUrl === null, "Record 2 zipUrl should be null");
    assert(record2.cloudinaryPublicId === null, "Record 2 cloudinaryPublicId should be null");
    logger.info("Scenario 2 PASSED.");

    // ----------------------------------------------------
    // Scenario 3: Validation failures (invalid inputs)
    // ----------------------------------------------------
    logger.info("--- Scenario 3: Validation failures ---");

    // Missing userId
    await assertThrows(
      () => logDelivery({
        medium: "email",
        recipient: "test@example.com",
        photoIds: testPhotoIds,
        format: "links"
      }),
      "userId is required"
    );

    // Invalid userId format
    await assertThrows(
      () => logDelivery({
        userId: "invalid-id",
        medium: "email",
        recipient: "test@example.com",
        photoIds: testPhotoIds,
        format: "links"
      }),
      "Invalid userId format"
    );

    // Missing medium
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        recipient: "test@example.com",
        photoIds: testPhotoIds,
        format: "links"
      }),
      "medium is required"
    );

    // Invalid medium
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "sms",
        recipient: "test@example.com",
        photoIds: testPhotoIds,
        format: "links"
      }),
      "medium must be 'email' or 'whatsapp'"
    );

    // Missing recipient
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "email",
        photoIds: testPhotoIds,
        format: "links"
      }),
      "recipient is required"
    );

    // Empty recipient
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "email",
        recipient: "   ",
        photoIds: testPhotoIds,
        format: "links"
      }),
      "recipient is required"
    );

    // Missing photoIds
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "email",
        recipient: "test@example.com",
        format: "links"
      }),
      "photoIds must be an array"
    );

    // Invalid photoId in array
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "email",
        recipient: "test@example.com",
        photoIds: [testPhotoIds[0], "invalid-photo-id"],
        format: "links"
      }),
      "Invalid photo ID format"
    );

    // Missing format
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "email",
        recipient: "test@example.com",
        photoIds: testPhotoIds
      }),
      "format is required"
    );

    // Invalid format
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "email",
        recipient: "test@example.com",
        photoIds: testPhotoIds,
        format: "pdf"
      }),
      "format must be 'links' or 'zip'"
    );

    // Invalid count (negative)
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "email",
        recipient: "test@example.com",
        photoIds: testPhotoIds,
        count: -1,
        format: "links"
      }),
      "count must be a non-negative number"
    );

    // Invalid count (not a number)
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "email",
        recipient: "test@example.com",
        photoIds: testPhotoIds,
        count: "three",
        format: "links"
      }),
      "count must be a non-negative number"
    );

    // Invalid zipUrl
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "email",
        recipient: "test@example.com",
        photoIds: testPhotoIds,
        format: "zip",
        zipUrl: 12345
      }),
      "zipUrl must be a string"
    );

    // Invalid cloudinaryPublicId
    await assertThrows(
      () => logDelivery({
        userId: testUserId,
        medium: "email",
        recipient: "test@example.com",
        photoIds: testPhotoIds,
        format: "zip",
        cloudinaryPublicId: true
      }),
      "cloudinaryPublicId must be a string"
    );

    logger.info("Scenario 3 PASSED.");

    logger.info("ALL TESTS PASSED SUCCESSFULLY!");
  } finally {
    logger.info("Cleaning up test records...");
    await DeliveryHistory.deleteMany({ userId: testUserId });
    await mongoose.disconnect();
    logger.info("Clean shutdown complete.");
  }
}

runTests().catch(async (err) => {
  logger.error({ err }, "Verification test execution failed");
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
