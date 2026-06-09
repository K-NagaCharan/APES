import mongoose from "mongoose";
import axios from "axios";
import { connectDB } from "../src/config/db.js";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Face from "../src/models/Face.js";
import Photo from "../src/models/Photo.js";
import { generateToken } from "../src/utils/jwt.js";

async function main() {
  console.log("=== STARTING PHOTO UPLOAD FACE INTEGRATION VERIFICATION ===");
  process.env.ALLOW_MOCK_CLOUDINARY = "true"; // Allow mock Cloudinary upload
  process.env.FORCE_MOCK_CLOUDINARY = "true"; // Force mock upload path in tests

  await connectDB();

  const testUserId = new mongoose.Types.ObjectId("60c72b2f9b1d8b2bad689a99");
  const token = generateToken(testUserId.toString(), "upload_tester");

  // Clean DB
  await Face.deleteMany({ userId: testUserId });
  await Photo.deleteMany({ userId: testUserId });
  await User.deleteMany({ _id: testUserId });

  // Create User
  const user = new User({
    _id: testUserId,
    username: "upload_tester",
    email: "tester@example.com",
    passwordHash: "hash123"
  });
  await user.save();

  // Spin up test server
  const server = app.listen(0);
  const port = server.address().port;
  console.log(`Test server started on port ${port}`);

  // Create a 1x1 png image buffer
  const base64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const imageBuffer = Buffer.from(base64Png, 'base64');

  // Construct standard multipart/form-data
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: "image/png" });
  formData.append("file", blob, "test_image.png");

  console.log("Sending photo upload request to /api/photos/upload...");
  try {
    const res = await axios.post(`http://localhost:${port}/api/v1/photos/upload`, formData, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("Upload response status:", res.status);
    console.log("Upload response data:", JSON.stringify(res.data, null, 2));

    if (res.status !== 201) {
      throw new Error(`Expected HTTP 201, got ${res.status}`);
    }

    const returnedPhoto = res.data.data.photo;
    if (returnedPhoto.faceCount !== 2) {
      throw new Error(`Expected faceCount to be 2, got ${returnedPhoto.faceCount}`);
    }

    // Verify Photo saved in DB
    const dbPhoto = await Photo.findById(returnedPhoto.id);
    if (!dbPhoto) {
      throw new Error("Photo not persisted in MongoDB");
    }
    if (dbPhoto.faceCount !== 2) {
      throw new Error(`DB photo faceCount expected 2, got ${dbPhoto.faceCount}`);
    }

    // Verify Face documents created in DB
    const dbFaces = await Face.find({ photoId: returnedPhoto.id, userId: testUserId });
    console.log(`Found ${dbFaces.length} face documents in DB for this photo.`);
    if (dbFaces.length !== 2) {
      throw new Error(`Expected 2 Face documents in MongoDB, got ${dbFaces.length}`);
    }

    // Verify bbox structure
    const face1 = dbFaces[0];
    if (
      !face1.bbox ||
      typeof face1.bbox.x !== "number" ||
      face1.bbox.w <= 0 ||
      face1.embedding.length !== 512
    ) {
      throw new Error(`Invalid Face properties in MongoDB. Face: ${JSON.stringify(face1)}`);
    }

    console.log("=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===");

    // Clean up
    await Face.deleteMany({ userId: testUserId });
    await Photo.deleteMany({ userId: testUserId });
    await User.deleteMany({ _id: testUserId });

  } catch (err) {
    console.error("TEST FAILED:", err.response ? err.response.data : err.message);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.connection.close();
    console.log("Server stopped and database connection closed.");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
