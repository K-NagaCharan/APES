import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";

async function main() {
  await connectDB();
  const deliveries = await DeliveryHistory.find().sort({ createdAt: -1 }).limit(5).lean();
  console.log("Latest deliveries:");
  console.log(JSON.stringify(deliveries, null, 2));
  await mongoose.disconnect();
}

main();
