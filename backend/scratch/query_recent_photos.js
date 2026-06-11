import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Photo from "../src/models/Photo.js";
import Face from "../src/models/Face.js";

async function main() {
  await connectDB();

  // Find last 10 uploaded photos sorted by ID
  const photos = await Photo.find({}).sort({ _id: -1 }).limit(10).lean();
  console.log(`Last 5 photos:`);
  for (const photo of photos) {
    console.log(`\nPhoto ID: ${photo._id}`);
    console.log(`  URL: ${photo.url}`);
    console.log(`  Status: ${photo.status}`);
    console.log(`  Created At: ${photo.createdAt}`);
    
    // Check how many faces were registered for this photo
    const faces = await Face.find({ photoId: photo._id }).lean();
    console.log(`  Faces in DB: ${faces.length}`);
    for (const face of faces) {
      console.log(`    Face ID: ${face._id}`);
      console.log(`      BBox: ${JSON.stringify(face.bbox)}`);
      console.log(`      Is Labeled: ${face.isLabeled}`);
    }
  }

  await mongoose.connection.close();
}

main();
