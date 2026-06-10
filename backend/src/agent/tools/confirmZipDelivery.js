import { confirmConfirmation, cancelConfirmation } from "../../services/zipConfirmation.service.js";
import { zipHelpers } from "../../services/zip.service.js";
import Photo from "../../models/Photo.js";
import DeliveryHistory from "../../models/DeliveryHistory.js";
import { addDeliveryJob } from "../../queues/delivery.queue.js";
import { logger } from "../../config/logger.js";

/**
 * Executes the confirmZipDelivery tool.
 * Handles confirming or cancelling a pending ZIP delivery session.
 */
export async function execute(args, userId) {
  const { sessionId, confirmed } = args;

  if (confirmed === false || confirmed === "false") {
    await cancelConfirmation(sessionId);
    logger.info({ sessionId }, "ZIP delivery request cancelled by user");
    return {
      success: true,
      confirmed: false,
      message: "Delivery request cancelled successfully."
    };
  }

  // Atomically retrieve and delete the session from Redis
  const payload = await confirmConfirmation(sessionId);

  // Initialize a single DeliveryHistory record in status 'queued' BEFORE ZIP generation
  const delivery = new DeliveryHistory({
    userId: payload.userId,
    recipient: payload.recipient,
    medium: payload.medium,
    photoIds: payload.photoIds,
    format: "zip",
    status: "queued",
    count: payload.count
  });
  await delivery.save();

  try {
    // Retrieve photo documents from MongoDB using photoIds
    const photos = await Photo.find({ _id: { $in: payload.photoIds } });
    if (!photos || photos.length === 0) {
      throw new Error("No photos found for confirmation");
    }

    // Call the ZIP compression service
    logger.info({ sessionId, count: photos.length }, "Compiling ZIP for confirmed delivery");
    const zipResult = await zipHelpers.createZip({ photos });

    // Update the same record in-place with the compiled ZIP details
    delivery.zipUrl = zipResult.zipUrl;
    delivery.cloudinaryPublicId = zipResult.cloudinaryPublicId;
    await delivery.save();

    // Enqueue the job in BullMQ
    await addDeliveryJob({ requestId: delivery._id.toString() });

    return {
      success: true,
      confirmed: true,
      deliveryId: delivery._id.toString(),
      zipUrl: zipResult.zipUrl,
      message: `${payload.medium === "email" ? "Email" : "WhatsApp"} delivery queued successfully using ZIP archive.`
    };
  } catch (err) {
    // Update the same record in-place to 'failed' status on ZIP generation failure
    delivery.status = "failed";
    delivery.error = err.message;
    await delivery.save();

    logger.error({ err: err.message, sessionId }, "ZIP generation failed for confirmed delivery");
    throw err;
  }
}
