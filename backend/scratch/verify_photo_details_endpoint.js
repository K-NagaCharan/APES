import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Photo from "../src/models/Photo.js";
import Face from "../src/models/Face.js";
import { logger } from "../src/config/logger.js";

async function verifyDetails() {
  await connectDB();
  
  // Find a photo that has faces if possible, otherwise any photo
  let photo = await Photo.findOne({ faceCount: { $gt: 0 } });
  if (!photo) {
    photo = await Photo.findOne({});
  }

  if (!photo) {
    logger.info("No photos found in database to verify details for.");
    await mongoose.disconnect();
    process.exit(0);
  }

  logger.info({ photoId: photo._id }, "Verifying details query for photo");

  // Query faces (similar to controller)
  const faces = await Face.find({ photoId: photo._id })
    .populate("personId", "name")
    .select("_id bbox personId")
    .lean();

  const formattedFaces = faces.map((face) => ({
    faceId: face._id,
    bbox: face.bbox,
    person: face.personId ? {
      id: face.personId._id,
      name: face.personId.name
    } : null
  }));

  const formattedPhoto = {
    id: photo._id,
    userId: photo.userId,
    url: photo.url,
    cloudinaryPublicId: photo.cloudinaryPublicId,
    width: photo.width,
    height: photo.height,
    status: photo.status,
    faceCount: photo.faceCount,
    uploadDate: photo.uploadDate,
    faces: formattedFaces
  };

  logger.info(formattedPhoto, "Formatted Photo Details Response Output");

  await mongoose.disconnect();
  process.exit(0);
}

verifyDetails().catch(err => {
  console.error(err);
  process.exit(1);
});
