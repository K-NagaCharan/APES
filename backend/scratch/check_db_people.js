import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Person from "../src/models/Person.js";
import Face from "../src/models/Face.js";
import { logger } from "../src/config/logger.js";

async function testQuery() {
  await connectDB();
  const userId = "6a268c108425277e3ddee488";
  
  const names = ["jan"].map(name => new RegExp(name.trim(), "i"));
  const matchedPeople = await Person.find({ userId, name: { $in: names } }).select("_id name").lean();
  logger.info({ matchedPeople }, "Results of Person.find with $in RegExp");

  if (matchedPeople.length > 0) {
    const personIds = matchedPeople.map(p => p._id);
    logger.info({ personIds }, "Found personIds");
    const faces = await Face.find({ userId, personId: { $in: personIds }, isLabeled: true }).select("photoId").lean();
    logger.info({ facesCount: faces.length, faces }, "Found faces");

    const uniquePhotoIds = Array.from(new Set(faces.map(f => f.photoId ? f.photoId.toString() : null).filter(Boolean)));
    logger.info({ uniquePhotoIdsCount: uniquePhotoIds.length, uniquePhotoIds }, "Unique Photo IDs");
  }

  await mongoose.disconnect();
  process.exit(0);
}

testQuery().catch(err => {
  console.error(err);
  process.exit(1);
});
