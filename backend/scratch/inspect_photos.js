import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Photo from "../src/models/Photo.js";

const userId = "6a268c108425277e3ddee488";

const run = async () => {
  await connectDB();
  console.log("Connected. Searching photos for user:", userId);
  const photos = await Photo.find({ userId }).lean();
  console.log(`Found ${photos.length} photos.`);
  photos.forEach(p => {
    console.log(`ID: ${p._id}, URL: ${p.url.substring(0, 45)}..., Bytes: ${p.bytes}, Status: ${p.status}`);
  });
  await mongoose.disconnect();
};

run().catch(console.error);
