import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";

async function main() {
  await connectDB();
  const timeLimit = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
  const deliveries = await DeliveryHistory.find({ createdAt: { $gte: timeLimit } })
    .sort({ createdAt: -1 })
    .lean();
  console.log(`Found ${deliveries.length} deliveries in the last 30 minutes:`);
  console.log(JSON.stringify(deliveries, null, 2));
  await mongoose.disconnect();
}

main();
