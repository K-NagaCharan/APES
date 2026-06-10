import DeliveryHistory from "../../models/DeliveryHistory.js";
import { addDeliveryJob } from "../../queues/delivery.queue.js";

/**
 * Executes the sendWhatsApp tool.
 * Creates a DeliveryHistory record in status "queued" and enqueues a BullMQ job.
 */
export async function execute(args, userId) {
  const { photoIds, phoneNumber } = args;

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
