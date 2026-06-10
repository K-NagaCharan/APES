import DeliveryHistory from "../../models/DeliveryHistory.js";
import { addDeliveryJob } from "../../queues/delivery.queue.js";

/**
 * Executes the sendEmail tool.
 * Creates a DeliveryHistory record in status "queued" and enqueues a BullMQ job.
 */
export async function execute(args, userId) {
  const { photoIds, email } = args;

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
