import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Photo from "../src/models/Photo.js";
import { logger } from "../src/config/logger.js";

async function checkPhotos() {
  await connectDB();
  const photos = await Photo.find({}).lean();
  logger.info({ count: photos.length }, "Retrieved photos from MongoDB");
  for (const photo of photos) {
    logger.info({
      id: photo._id,
      userId: photo.userId,
      status: photo.status,
      cloudinaryPublicId: photo.cloudinaryPublicId
    }, "Photo Document");
  }
  await mongoose.disconnect();
  process.exit(0);
}

checkPhotos().catch(err => {
  console.error(err);
  process.exit(1);
});
