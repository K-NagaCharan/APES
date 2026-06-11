import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Face from "../src/models/Face.js";
import Person from "../src/models/Person.js";
import Photo from "../src/models/Photo.js";

async function main() {
  await connectDB();

  const urls = [
    "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781073776/apes/photos/oevj7l3w0fhavza9dr84.jpg",
    "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781076210/apes/photos/jkzgx8bkfzn3mlhfeze8.jpg"
  ];

  for (const url of urls) {
    const photo = await Photo.findOne({ url }).lean();
    if (!photo) {
      console.log(`Photo not found for URL: ${url}`);
      continue;
    }
    console.log(`\nPhoto ID: ${photo._id} (URL: ${url})`);
    
    const faces = await Face.find({ photoId: photo._id }).populate("personId").lean();
    console.log(`Found ${faces.length} faces:`);
    for (const face of faces) {
      console.log(`  Face ID: ${face._id}`);
      console.log(`    BBox: ${JSON.stringify(face.bbox)}`);
      console.log(`    Person Name: ${face.personId ? face.personId.name : "None"}`);
      console.log(`    Is Labeled: ${face.isLabeled}`);
      console.log(`    Label Source: ${face.labelSource}`);
    }
  }

  await mongoose.connection.close();
}

main();
