import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Photo from "../src/models/Photo.js";

const run = async () => {
  await connectDB();
  console.log("Connected to database. Searching for Photo records missing bytes...");

  // Find photos where bytes is null, undefined, or missing
  const photos = await Photo.find({
    $or: [
      { bytes: null },
      { bytes: { $exists: false } }
    ]
  });

  console.log(`Found ${photos.length} photos with missing bytes.`);

  let updatedCount = 0;
  for (const photo of photos) {
    let fallbackBytes = 1048576; // Default to 1MB

    // Estimate size from dimensions if available
    if (photo.width && photo.height) {
      fallbackBytes = Math.round(photo.width * photo.height * 0.25);
    }

    photo.bytes = fallbackBytes;
    await photo.save();
    updatedCount++;
  }

  console.log(`Successfully migrated ${updatedCount} photo(s).`);
  await mongoose.disconnect();
  console.log("Disconnected from database.");
};

run().catch(console.error);
