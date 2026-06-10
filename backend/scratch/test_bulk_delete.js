import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { bulkDeletePhotos } from "../src/controllers/photo.controller.js";
import Photo from "../src/models/Photo.js";
import { logger } from "../src/config/logger.js";

async function testBulkDelete() {
  await connectDB();
  logger.info("Database connected.");

  const testUserId = new mongoose.Types.ObjectId();

  // Create a couple of mock photos
  const photo1 = new Photo({
    userId: testUserId,
    url: "http://example.com/p1.jpg",
    cloudinaryPublicId: "p1_id",
    status: "completed"
  });
  const photo2 = new Photo({
    userId: testUserId,
    url: "http://example.com/p2.jpg",
    cloudinaryPublicId: "p2_id",
    status: "completed"
  });

  await photo1.save();
  await photo2.save();
  logger.info("Saved 2 mock photos.");

  const ids = [photo1._id.toString(), photo2._id.toString()];

  // Mock Request and Response
  const req = {
    body: { ids },
    user: { _id: testUserId },
    id: "test-request"
  };

  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    }
  };

  try {
    // Since bulkDeletePhotos is wrapped in asyncHandler, it runs asynchronously and returns a promise resolved via Promise.resolve.
    // We can call it and then wait for it to finish or call the unwrapped controller.
    // Let's wait for a second to let it complete.
    bulkDeletePhotos(req, res);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    logger.info({ statusCode: res.statusCode, data: res.data }, "Controller responded");
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, "Controller threw exception");
  }


  // Double check DB
  const count = await Photo.countDocuments({ _id: { $in: [photo1._id, photo2._id] } });
  logger.info({ remainingCount: count }, "Database check complete.");

  await mongoose.disconnect();
  process.exit(0);
}

testBulkDelete().catch(err => {
  console.error("Unhandled rejection", err);
  process.exit(1);
});
