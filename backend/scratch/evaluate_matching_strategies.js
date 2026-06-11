import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Face from "../src/models/Face.js";
import Person from "../src/models/Person.js";
import { cosineSimilarity } from "../src/utils/cosineSimilarity.js";
import { l2Normalize } from "../src/services/faceMatching.service.js";

async function main() {
  await connectDB();

  const faces = await Face.find({ personId: { $ne: null }, labelSource: "manual" })
    .populate("personId")
    .lean();

  console.log(`Loaded ${faces.length} manual labeled faces for evaluation.`);

  if (faces.length < 5) {
    console.log("Too few manual faces in database to perform validation.");
    await mongoose.connection.close();
    return;
  }

  // Group faces by personId
  const peopleGroups = {};
  for (const face of faces) {
    const pid = face.personId._id.toString();
    if (!peopleGroups[pid]) {
      peopleGroups[pid] = [];
    }
    peopleGroups[pid].push(face);
  }

  // Keep only people with at least 2 manual faces (so we can leave one out)
  const validPids = Object.keys(peopleGroups).filter(pid => peopleGroups[pid].length >= 2);
  console.log(`Found ${validPids.length} people with at least 2 manual faces.`);

  if (validPids.length === 0) {
    console.log("No people have at least 2 manual faces. Cannot perform leave-one-out cross-validation.");
    await mongoose.connection.close();
    return;
  }

  let totalQueries = 0;
  let oldCentroidCorrect = 0;
  let newMultiCorrect = 0;

  // Let's test different thresholds
  const thresholds = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7];
  const stats = thresholds.reduce((acc, t) => {
    acc[t] = {
      old: { correct: 0, falsePos: 0, unassigned: 0 },
      new: { correct: 0, falsePos: 0, unassigned: 0 },
      margin: { correct: 0, falsePos: 0, unassigned: 0 }
    };
    return acc;
  }, {});

  for (const pid of validPids) {
    const personFaces = peopleGroups[pid];
    for (let index = 0; index < personFaces.length; index++) {
      totalQueries++;
      const queryFace = personFaces[index];
      const queryEmb = queryFace.embedding;

      // 1. Build the dataset excluding the queryFace
      const remainingFaces = [];
      const remainingByPerson = {};

      for (const p of Object.keys(peopleGroups)) {
        remainingByPerson[p] = [];
        for (let j = 0; j < peopleGroups[p].length; j++) {
          const f = peopleGroups[p][j];
          if (f._id.toString() !== queryFace._id.toString()) {
            remainingFaces.push(f);
            remainingByPerson[p].push(f);
          }
        }
      }

      // 2. Evaluate Strategy A: Single Centroid
      // Compute centroid for each person using remaining faces
      const centroids = {};
      for (const p of Object.keys(remainingByPerson)) {
        const pFaces = remainingByPerson[p];
        if (pFaces.length === 0) continue;

        const normalizedEmbs = pFaces.map(f => l2Normalize(f.embedding));
        const sumVec = new Array(512).fill(0);
        for (const emb of normalizedEmbs) {
          for (let i = 0; i < 512; i++) {
            sumVec[i] += emb[i];
          }
        }
        const avgVec = sumVec.map(v => v / normalizedEmbs.length);
        centroids[p] = l2Normalize(avgVec);
      }

      let bestScoreOld = -1.0;
      let secondScoreOld = -1.0;
      let bestPidOld = null;

      for (const p of Object.keys(centroids)) {
        try {
          const sim = cosineSimilarity(queryEmb, centroids[p]);
          if (sim > bestScoreOld) {
            secondScoreOld = bestScoreOld;
            bestScoreOld = sim;
            bestPidOld = p;
          } else if (sim > secondScoreOld) {
            secondScoreOld = sim;
          }
        } catch (e) {}
      }

      // 3. Evaluate Strategy B: Multi-Embedding (Max Similarity to any manual face)
      let bestScoreNew = -1.0;
      let secondScoreNew = -1.0;
      let bestPidNew = null;

      for (const p of Object.keys(remainingByPerson)) {
        const pFaces = remainingByPerson[p];
        if (pFaces.length === 0) continue;

        // Find max similarity to any face of this person
        let maxSim = -1.0;
        for (const f of pFaces) {
          try {
            const sim = cosineSimilarity(queryEmb, f.embedding);
            if (sim > maxSim) {
              maxSim = sim;
            }
          } catch (e) {}
        }

        if (maxSim > bestScoreNew) {
          secondScoreNew = bestScoreNew;
          bestScoreNew = maxSim;
          bestPidNew = p;
        } else if (maxSim > secondScoreNew) {
          secondScoreNew = maxSim;
        }
      }

      // Check results for each threshold
      for (const t of thresholds) {
        // Old Centroid Decision
        if (bestScoreOld >= t) {
          if (bestPidOld === pid) {
            stats[t].old.correct++;
          } else {
            stats[t].old.falsePos++;
            if (t === 0.55) {
              console.log(`[False Pos A @ 0.55]: Query '${queryFace.personId.name}' (Face ID: ${queryFace._id}) matches '${remainingByPerson[bestPidOld][0].personId.name}' with score ${bestScoreOld.toFixed(4)}`);
            }
          }
        } else {
          stats[t].old.unassigned++;
          if (t === 0.55) {
            console.log(`[Unassigned A @ 0.55]: Query '${queryFace.personId.name}' (Face ID: ${queryFace._id}) best score is ${bestScoreOld.toFixed(4)} with '${bestPidOld ? remainingByPerson[bestPidOld][0].personId.name : "None"}'`);
          }
        }

        // New Multi-Embedding Decision
        if (bestScoreNew >= t) {
          if (bestPidNew === pid) {
            stats[t].new.correct++;
          } else {
            stats[t].new.falsePos++;
          }
        } else {
          stats[t].new.unassigned++;
        }

        // Strategy C: Centroid + Margin (0.05)
        const satisfiesMargin = (bestScoreOld - secondScoreOld) >= 0.05;
        if (bestScoreOld >= t && satisfiesMargin) {
          if (bestPidOld === pid) {
            stats[t].margin.correct++;
          } else {
            stats[t].margin.falsePos++;
          }
        } else {
          stats[t].margin.unassigned++;
        }
      }
    }
  }

  console.log("\n=================== VALIDATION RESULTS ===================");
  console.log(`Total queries tested: ${totalQueries}`);
  
  console.log("\nThreshold | Strategy A: Single Centroid            | Strategy B: Multi-Embedding          | Strategy C: Centroid + Margin (0.05)");
  console.log("          | Recall (Correct) | False Pos | Unassigned| Recall (Correct) | False Pos | Unassigned| Recall (Correct) | False Pos | Unassigned");
  console.log("----------------------------------------------------------------------------------------------------------------------------------------------");
  for (const t of thresholds) {
    const oldRecall = (stats[t].old.correct / totalQueries) * 100;
    const oldFP = (stats[t].old.falsePos / totalQueries) * 100;
    const oldUn = (stats[t].old.unassigned / totalQueries) * 100;

    const newRecall = (stats[t].new.correct / totalQueries) * 100;
    const newFP = (stats[t].new.falsePos / totalQueries) * 100;
    const newUn = (stats[t].new.unassigned / totalQueries) * 100;

    const margRecall = (stats[t].margin.correct / totalQueries) * 100;
    const margFP = (stats[t].margin.falsePos / totalQueries) * 100;
    const margUn = (stats[t].margin.unassigned / totalQueries) * 100;

    console.log(
      `${t.toFixed(2)}      | ` +
      `${oldRecall.toFixed(1)}% (${stats[t].old.correct})   | ` +
      `${oldFP.toFixed(1)}% (${stats[t].old.falsePos})  | ` +
      `${oldUn.toFixed(1)}% (${stats[t].old.unassigned}) | ` +
      `${newRecall.toFixed(1)}% (${stats[t].new.correct})   | ` +
      `${newFP.toFixed(1)}% (${stats[t].new.falsePos})  | ` +
      `${newUn.toFixed(1)}% (${stats[t].new.unassigned}) | ` +
      `${margRecall.toFixed(1)}% (${stats[t].margin.correct})   | ` +
      `${margFP.toFixed(1)}% (${stats[t].margin.falsePos})  | ` +
      `${margUn.toFixed(1)}% (${stats[t].margin.unassigned})`
    );
  }

  await mongoose.connection.close();
}

main();
