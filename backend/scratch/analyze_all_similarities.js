import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Face from "../src/models/Face.js";
import Person from "../src/models/Person.js";
import { cosineSimilarity } from "../src/utils/cosineSimilarity.js";

async function main() {
  await connectDB();

  const faces = await Face.find({ personId: { $ne: null } }).populate("personId").lean();
  console.log(`Loaded ${faces.length} labeled faces from DB.`);

  const stats = {
    samePerson: [],
    diffPerson: []
  };

  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const faceA = faces[i];
      const faceB = faces[j];
      
      try {
        const sim = cosineSimilarity(faceA.embedding, faceB.embedding);
        const isSame = faceA.personId._id.toString() === faceB.personId._id.toString() || 
                       faceA.personId.name.toLowerCase() === faceB.personId.name.toLowerCase();
        
        if (isSame) {
          stats.samePerson.push({
            nameA: faceA.personId.name,
            nameB: faceB.personId.name,
            sim
          });
        } else {
          stats.diffPerson.push({
            nameA: faceA.personId.name,
            nameB: faceB.personId.name,
            sim
          });
        }
      } catch (err) {
        // ignore
      }
    }
  }

  // Calculate statistics for Same Person
  if (stats.samePerson.length > 0) {
    stats.samePerson.sort((a, b) => a.sim - b.sim);
    const minSame = stats.samePerson[0].sim;
    const maxSame = stats.samePerson[stats.samePerson.length - 1].sim;
    const avgSame = stats.samePerson.reduce((acc, curr) => acc + curr.sim, 0) / stats.samePerson.length;
    console.log(`\n--- SAME PERSON SIMILARITIES (${stats.samePerson.length} pairs) ---`);
    console.log(`Min Similarity: ${minSame.toFixed(4)}`);
    console.log(`Max Similarity: ${maxSame.toFixed(4)}`);
    console.log(`Avg Similarity: ${avgSame.toFixed(4)}`);
  } else {
    console.log("\nNo same-person pairs found.");
  }

  // Calculate statistics for Different Person
  if (stats.diffPerson.length > 0) {
    stats.diffPerson.sort((a, b) => a.sim - b.sim);
    const minDiff = stats.diffPerson[0].sim;
    const maxDiff = stats.diffPerson[stats.diffPerson.length - 1].sim;
    const avgDiff = stats.diffPerson.reduce((acc, curr) => acc + curr.sim, 0) / stats.diffPerson.length;
    console.log(`\n--- DIFFERENT PERSON SIMILARITIES (${stats.diffPerson.length} pairs) ---`);
    console.log(`Min Similarity: ${minDiff.toFixed(4)}`);
    console.log(`Max Similarity: ${maxDiff.toFixed(4)}`);
    console.log(`Avg Similarity: ${avgDiff.toFixed(4)}`);
    
    // Check how many different person pairs exceed certain thresholds
    const thresholds = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85];
    console.log("\nFalse positive rates at different thresholds (different people similarity >= threshold):");
    for (const t of thresholds) {
      const count = stats.diffPerson.filter(p => p.sim >= t).length;
      const rate = (count / stats.diffPerson.length) * 100;
      console.log(`Threshold >= ${t}: ${count} pairs (${rate.toFixed(2)}%)`);
    }

    console.log("\nSame person recall rates at different thresholds (same people similarity >= threshold):");
    for (const t of thresholds) {
      const count = stats.samePerson.filter(p => p.sim >= t).length;
      const rate = (count / stats.samePerson.length) * 100;
      console.log(`Threshold >= ${t}: ${count} pairs (${rate.toFixed(2)}%)`);
    }
  } else {
    console.log("\nNo different-person pairs found.");
  }

  await mongoose.connection.close();
}

main();
