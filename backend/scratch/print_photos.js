import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Photo from "../src/models/Photo.js";

async function main() {
  await connectDB();
  const photos = await Photo.find({});
  for (const photo of photos) {
    console.log(`ID: ${photo._id}, URL: ${photo.url}, status: ${photo.status}, faceCount: ${photo.faceCount}`);
  }
  await mongoose.connection.close();
}
main();
