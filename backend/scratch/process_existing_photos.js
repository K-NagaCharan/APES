import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Photo from "../src/models/Photo.js";
import Face from "../src/models/Face.js";
import { recognizeFaces } from "../src/services/faceRecognition.service.js";
import { processRecognizedFaces } from "../src/services/facePersistence.service.js";

async function main() {
  console.log("=== STARTING CLOUD IMAGE FACE RE-SCAN FOR EXISTING PHOTOS ===");
  await connectDB();

  // Find all photos
  const photos = await Photo.find({});
  console.log(`Found ${photos.length} photos total in MongoDB.`);

  let processedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const photo of photos) {
    // Check if faces have already been processed for this photo
    const faceCount = await Face.countDocuments({ photoId: photo._id });
    if (faceCount > 0) {
      console.log(`Photo ${photo._id} already has ${faceCount} faces processed. Skipping.`);
      // Update photo faceCount if not set/different
      if (photo.faceCount !== faceCount) {
        photo.faceCount = faceCount;
        await photo.save();
      }
      skippedCount++;
      continue;
    }

    console.log(`Processing photo ${photo._id} (URL: ${photo.url})...`);
    try {
      const recognitionResult = await recognizeFaces(photo.url);
      if (recognitionResult && recognitionResult.faces) {
        const summary = await processRecognizedFaces(photo._id, recognitionResult.faces);
        photo.faceCount = summary.processed;
        await photo.save();
        console.log(`Processed photo ${photo._id}: detected & saved ${summary.processed} faces.`);
        processedCount++;
      } else {
        console.log(`No faces detected for photo ${photo._id}.`);
        processedCount++;
      }
    } catch (err) {
      console.error(`Failed to process faces for photo ${photo._id}: ${err.message}`);
      failedCount++;
    }
  }

  console.log(`\n=== PROCESS COMPLETED ===`);
  console.log(`Total: ${photos.length}`);
  console.log(`Processed: ${processedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Failed: ${failedCount}`);

  await mongoose.connection.close();
  console.log("Database connection closed.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
