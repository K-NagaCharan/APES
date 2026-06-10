import DeliveryHistory from "../../models/DeliveryHistory.js";
import { addDeliveryJob } from "../../queues/delivery.queue.js";
import { checkDeliverySize } from "../../services/deliverySize.service.js";
import { createConfirmation } from "../../services/zipConfirmation.service.js";

/**
 * Executes the sendEmail tool.
 * Creates a DeliveryHistory record in status "queued" and enqueues a BullMQ job.
 */
export async function execute(args, userId) {
  const { photoIds, email } = args;

  // Perform size checking
  const sizeCheck = await checkDeliverySize({ photoIds });
  if (sizeCheck.exceedsThreshold) {
    const confirmation = await createConfirmation({
      userId,
      medium: "email",
      recipient: email,
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

  // Save delivery history
  const delivery = new DeliveryHistory({
    userId,
    recipient: email,
    medium: "email",
    photoIds,
    status: "queued"
  });
  await delivery.save();

  // Enqueue job in BullMQ
  await addDeliveryJob({ requestId: delivery._id.toString() });

  return {
    success: true,
    message: `Email delivery queued successfully. Request ID: ${delivery._id}`
  };
}
