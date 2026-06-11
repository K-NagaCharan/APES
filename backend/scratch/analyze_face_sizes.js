import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Face from "../src/models/Face.js";
import Person from "../src/models/Person.js";

async function main() {
  await connectDB();

  const faces = await Face.find({ personId: { $ne: null } }).populate("personId").lean();
  console.log(`Loaded ${faces.length} labeled faces from DB.`);

  const buckets = {
    tiny: 0,     // < 40px width or height
    small: 0,    // 40-80px
    medium: 0,   // 80-200px
    large: 0     // > 200px
  };

  const personStats = {};

  for (const face of faces) {
    const w = face.bbox.w;
    const h = face.bbox.h;
    const size = Math.min(w, h);

    if (size < 40) buckets.tiny++;
    else if (size < 80) buckets.small++;
    else if (size < 200) buckets.medium++;
    else buckets.large++;

    const pname = face.personId.name;
    if (!personStats[pname]) {
      personStats[pname] = { total: 0, tiny: 0, small: 0, medium: 0, large: 0 };
    }
    personStats[pname].total++;
    if (size < 40) personStats[pname].tiny++;
    else if (size < 80) personStats[pname].small++;
    else if (size < 200) personStats[pname].medium++;
    else personStats[pname].large++;
  }

  console.log("\n--- Face Size Distribution (Min Dimension of Bounding Box) ---");
  console.log(`Tiny (<40px):   ${buckets.tiny} (${((buckets.tiny/faces.length)*100).toFixed(1)}%)`);
  console.log(`Small (40-80px): ${buckets.small} (${((buckets.small/faces.length)*100).toFixed(1)}%)`);
  console.log(`Medium (80-200px): ${buckets.medium} (${((buckets.medium/faces.length)*100).toFixed(1)}%)`);
  console.log(`Large (>200px):  ${buckets.large} (${((buckets.large/faces.length)*100).toFixed(1)}%)`);

  console.log("\n--- Face Sizes By Person ---");
  for (const name of Object.keys(personStats).sort()) {
    const s = personStats[name];
    console.log(`Person: '${name}' (Total Faces: ${s.total})`);
    console.log(`  Tiny:   ${s.tiny} (${((s.tiny/s.total)*100).toFixed(1)}%)`);
    console.log(`  Small:  ${s.small} (${((s.small/s.total)*100).toFixed(1)}%)`);
    console.log(`  Medium: ${s.medium} (${((s.medium/s.total)*100).toFixed(1)}%)`);
    console.log(`  Large:  ${s.large} (${((s.large/s.total)*100).toFixed(1)}%)`);
  }

  await mongoose.connection.close();
}

main();
