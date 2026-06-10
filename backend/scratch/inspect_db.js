import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";
import { logger } from "../src/config/logger.js";

async function inspect() {
  await connectDB();
  logger.info("Connected to DB. Fetching last 10 delivery history entries...");
  const records = await DeliveryHistory.find().sort({ createdAt: -1 }).limit(10);
  for (const r of records) {
    logger.info({
      id: r._id,
      userId: r.userId,
      recipient: r.recipient,
      medium: r.medium,
      status: r.status,
      count: r.count,
      error: r.error,
      createdAt: r.createdAt,
      deliveredAt: r.deliveredAt
    });
  }
  await mongoose.disconnect();
}

inspect().catch(err => {
  logger.error(err);
  process.exit(1);
});
