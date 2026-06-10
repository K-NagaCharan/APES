import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { execute as executeSendWhatsApp } from "../src/agent/tools/sendWhatsApp.js";
import Photo from "../src/models/Photo.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";
import { uploadStream } from "../src/services/photo.service.js";
import cloudinary from "../src/config/cloudinary.js";
import { logger } from "../src/config/logger.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";

const assert = (condition, message) => {
  if (!condition) {
    logger.error(`Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
};

const dummyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

async function runTests() {
  logger.info("Connecting to MongoDB database...");
  await connectDB();

  const testUserId = new mongoose.Types.ObjectId();
  let photoDoc;
  let uploadRes;

  try {
    logger.info("Uploading mock photo to Cloudinary...");
    uploadRes = await uploadStream(dummyPng);

    photoDoc = await Photo.create({
      userId: testUserId,
      url: uploadRes.secure_url,
      cloudinaryPublicId: uploadRes.public_id,
      bytes: uploadRes.bytes,
      status: "completed"
    });

    logger.info("Executing sendWhatsApp tool with format: 'zip'...");
    const result = await executeSendWhatsApp(
      {
        photoIds: [photoDoc._id.toString()],
        phoneNumber: "+919999999999",
        format: "zip"
      },
      testUserId
    );

    logger.info({ result }, "Tool Result");
    assert(result.success === true, "Tool should return success: true");
    assert(result.message.includes("ZIP archive"), "Message should mention ZIP archive");

    // Extract requestId from message
    const requestIdMatch = result.message.match(/Request ID: (\w+)/);
    assert(requestIdMatch, "Message must contain Request ID");
    const requestId = requestIdMatch[1];

    const deliveryRecord = await DeliveryHistory.findById(requestId);
    assert(deliveryRecord, "Delivery record should be saved in DB");
    assert(deliveryRecord.format === "zip", "Delivery format should be 'zip'");
    assert(deliveryRecord.zipUrl, "Delivery record should have zipUrl populated");
    assert(deliveryRecord.cloudinaryPublicId, "Delivery record should have cloudinaryPublicId populated");
    assert(!deliveryRecord.zipUrl.includes(".zip"), "zipUrl should not end with .zip");

    logger.info("EXPLICIT ZIP DELIVERY VERIFICATION PASSED SUCCESSFULLY!");

    // Clean up created ZIP asset
    await cloudinary.uploader.destroy(deliveryRecord.cloudinaryPublicId, { resource_type: "raw" });
  } finally {
    if (photoDoc) {
      await Photo.deleteOne({ _id: photoDoc._id });
    }
    if (uploadRes) {
      await cloudinary.uploader.destroy(uploadRes.public_id);
    }
    await closeBullMQConnection();
    await mongoose.disconnect();
    logger.info("Cleanup and disconnected.");
  }
}

runTests().catch(err => {
  logger.error("Verification failed:", err);
  process.exit(1);
});
