import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Face from "../src/models/Face.js";
import Person from "../src/models/Person.js";

async function main() {
  await connectDB();

  const people = await Person.find({}).lean();
  console.log(`Found ${people.length} people in DB.`);

  for (const person of people) {
    const faceCount = await Face.countDocuments({ personId: person._id });
    const manualCount = await Face.countDocuments({ personId: person._id, labelSource: "manual" });
    const propCount = await Face.countDocuments({ personId: person._id, labelSource: "propagation" });
    console.log(`Person: '${person.name}' (_id: ${person._id})`);
    console.log(`  Centroid: ${person.centroid ? "Exists (Length: " + person.centroid.length + ")" : "None"}`);
    console.log(`  CentroidCount: ${person.centroidCount}`);
    console.log(`  Total Faces: ${faceCount} (Manual: ${manualCount}, Propagated: ${propCount})`);
  }

  await mongoose.connection.close();
}

main();
