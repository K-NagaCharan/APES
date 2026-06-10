import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { addDeliveryJob } from "../src/queues/delivery.queue.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";
import Photo from "../src/models/Photo.js";
import { logger } from "../src/config/logger.js";
import redis from "../src/config/redis.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";

async function trigger() {
  await connectDB();

  // Find a valid photo
  const photo = await Photo.findOne();
  const photoIds = photo ? [photo._id] : [];
  logger.info({ photoIds }, "Using photos for test");

  // Create queued DeliveryHistory record
  const delivery = new DeliveryHistory({
    userId: "6a268c108425277e3ddee488",
    recipient: "9493375383",
    medium: "whatsapp",
    photoIds,
    status: "queued"
  });
  await delivery.save();
  logger.info({ id: delivery._id }, "Created queued DeliveryHistory record");

  // Queue job
  await addDeliveryJob({ requestId: delivery._id.toString() });
  logger.info("Job successfully queued. Waiting 10 seconds to inspect database...");

  await new Promise(resolve => setTimeout(resolve, 10000));

  // Retrieve updated record
  const updated = await DeliveryHistory.findById(delivery._id);
  logger.info({
    id: updated._id,
    status: updated.status,
    error: updated.error,
    messageId: updated.messageId,
    deliveredAt: updated.deliveredAt
  }, "Inspected updated DeliveryHistory record");

  await mongoose.disconnect();
  await redis.quit();
  await closeBullMQConnection();
}

trigger().catch(err => {
  logger.error(err);
  process.exit(1);
});
