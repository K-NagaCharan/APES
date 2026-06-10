import DeliveryHistory from "../../models/DeliveryHistory.js";
import { addDeliveryJob } from "../../queues/delivery.queue.js";
import { checkDeliverySize } from "../../services/deliverySize.service.js";
import { createConfirmation } from "../../services/zipConfirmation.service.js";
import Photo from "../../models/Photo.js";
import { zipHelpers } from "../../services/zip.service.js";

/**
 * Executes the sendWhatsApp tool.
 * Creates a DeliveryHistory record in status "queued" and enqueues a BullMQ job.
 */
export async function execute(args, userId) {
  const { photoIds, phoneNumber, format } = args;

  // Perform size checking
  const sizeCheck = await checkDeliverySize({ photoIds });
  if (sizeCheck.exceedsThreshold) {
    const confirmation = await createConfirmation({
      userId,
      medium: "whatsapp",
      recipient: phoneNumber,
      photoIds,
      totalBytes: sizeCheck.totalBytes,
      count: sizeCheck.count
    });

    return {
      requiresConfirmation: true,
      sessionId: confirmation.sessionId,
      count: sizeCheck.count,
      totalBytes: sizeCheck.totalBytes,
      expiresAt: confirmation.expiresAt.toISOString()
    };
  }

  // Under threshold: check if explicit ZIP format is requested
  if (format === "zip") {
    const photos = await Photo.find({ _id: { $in: photoIds } });
    if (!photos || photos.length === 0) {
      throw new Error("No photos found to deliver.");
    }

    const zipResult = await zipHelpers.createZip({ photos });

    const delivery = new DeliveryHistory({
      userId,
      recipient: phoneNumber,
      medium: "whatsapp",
      photoIds,
      format: "zip",
      zipUrl: zipResult.zipUrl,
      cloudinaryPublicId: zipResult.cloudinaryPublicId,
      status: "queued"
    });
    await delivery.save();

    await addDeliveryJob({ requestId: delivery._id.toString() });

    return {
      success: true,
      message: `WhatsApp delivery queued successfully as a ZIP archive. Request ID: ${delivery._id}`
    };
  }

  // Save delivery history
  const delivery = new DeliveryHistory({
    userId,
    recipient: phoneNumber,
    medium: "whatsapp",
    photoIds,
    status: "queued"
  });
  await delivery.save();

  // Enqueue job in BullMQ
  await addDeliveryJob({ requestId: delivery._id.toString() });

  return {
    success: true,
    message: `WhatsApp delivery queued successfully. Request ID: ${delivery._id}`
  };
}

