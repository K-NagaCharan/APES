import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Face from "../src/models/Face.js";
import Person from "../src/models/Person.js";
import Photo from "../src/models/Photo.js";

async function main() {
  await connectDB();

  const faceIds = ["6a290e6f5068584cb25798c7", "6a290e805068584cb25798e0"];
  for (const id of faceIds) {
    const face = await Face.findById(id).populate("personId").populate("photoId").lean();
    if (face) {
      console.log(`Face ID: ${face._id}`);
      console.log(`  BBox: ${JSON.stringify(face.bbox)}`);
      console.log(`  Photo URL: ${face.photoId ? face.photoId.url : "None"}`);
      console.log(`  Person ID: ${face.personId ? face.personId._id : "None"}`);
      console.log(`  Person Name: ${face.personId ? face.personId.name : "None"}`);
      console.log(`  Is Labeled: ${face.isLabeled}`);
      console.log(`  Label Source: ${face.labelSource}`);
    } else {
      console.log(`Face ${id} not found.`);
    }
  }

  await mongoose.connection.close();
}

main();
