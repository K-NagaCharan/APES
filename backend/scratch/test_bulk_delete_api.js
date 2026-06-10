import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import Photo from "../src/models/Photo.js";
import { logger } from "../src/config/logger.js";
import mongoose from "mongoose";

const BASE_URL = "http://localhost:5000/api/v1";

async function testBulkDeleteAPI() {
  await connectDB();

  // 1. Create/Register a fresh test user
  const email = `test-${Date.now()}@example.com`;
  const username = `user-${Date.now()}`;
  const password = "password123";

  logger.info({ email, username }, "Registering test user via API...");
  
  let registerRes;
  try {
    registerRes = await axios.post(`${BASE_URL}/auth/register`, {
      username,
      email,
      password
    });
  } catch (err) {
    logger.error({ err: err.response?.data || err.message }, "Registration failed");
    process.exit(1);
  }

  const { token, user } = registerRes.data.data;
  const authHeaders = { Authorization: `Bearer ${token}` };

  logger.info({ userId: user.id }, "User registered successfully. Uploading test photo...");

  // 2. Upload a test photo
  // Create a tiny 1x1 pixel mock PNG buffer
  const pixelPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const imageBuffer = Buffer.from(pixelPngBase64, "base64");
  
  const form = new FormData();
  form.append("file", imageBuffer, { filename: "pixel.png", contentType: "image/png" });

  let uploadRes;
  try {
    uploadRes = await axios.post(`${BASE_URL}/photos/upload`, form, {
      headers: {
        ...form.getHeaders(),
        ...authHeaders
      }
    });
  } catch (err) {
    logger.error({ err: err.response?.data || err.message }, "Upload failed");
    process.exit(1);
  }

  const photoId = uploadRes.data.data.photo.id;
  logger.info({ photoId }, "Photo uploaded successfully. Triggering bulk-delete...");

  // 3. Call bulk-delete
  let deleteRes;
  try {
    deleteRes = await axios.post(`${BASE_URL}/photos/bulk-delete`, {
      ids: [photoId]
    }, {
      headers: authHeaders
    });
    logger.info({ status: deleteRes.status, data: deleteRes.data }, "Bulk delete request succeeded");
  } catch (err) {
    logger.error({ err: err.response?.data || err.message, status: err.response?.status }, "Bulk delete request failed");
  }

  // 4. Verify in DB
  const dbPhoto = await Photo.findById(photoId);
  if (!dbPhoto) {
    logger.info("Database check: Photo was successfully deleted from MongoDB.");
  } else {
    logger.error({ photoStatus: dbPhoto.status }, "Database check: Photo still exists in MongoDB!");
  }

  // Clean up user
  await User.deleteOne({ _id: user.id });
  await mongoose.disconnect();
  process.exit(0);
}

testBulkDeleteAPI().catch(err => {
  console.error("Unhandled rejection", err);
  process.exit(1);
});
