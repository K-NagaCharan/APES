import { createConfirmation } from "../../services/zipConfirmation.service.js";
import { logger } from "../../config/logger.js";

/**
 * Executes the requestZipConfirmation tool.
 * Dynamically creates a pending ZIP confirmation session in Redis using the session memory
 * and returns a real sessionId.
 */
export async function execute(args, userId, session) {
  const deliveryMethod = args?.deliveryMethod || "email";
  const estimatedSizeMB = args?.estimatedSizeMB || 0;

  // Resolve photoIds and count from last photo search in session
  const photoIds = session?.memory?.lastPhotoSearch?.photoIds || [];
  const count = photoIds.length;

  // Resolve recipient from last delivery attempt or use a placeholder if not found
  const recipient = session?.memory?.lastDelivery?.destination || (deliveryMethod === "email" ? "pending@example.com" : "0000000000");

  const totalBytes = Math.round(estimatedSizeMB * 1024 * 1024);

  try {
    if (photoIds.length === 0) {
      logger.warn({ userId }, "requestZipConfirmation called but lastPhotoSearch photoIds is empty");
      return {
        requiresConfirmation: true,
        estimatedSizeMB,
        deliveryMethod,
        message: "No photos found in session to deliver."
      };
    }

    const confirmation = await createConfirmation({
      userId,
      medium: deliveryMethod,
      recipient,
      photoIds,
      totalBytes,
      count
    });

    logger.info({ sessionId: confirmation.sessionId }, "requestZipConfirmation successfully created confirmation session");

    return {
      requiresConfirmation: true,
      sessionId: confirmation.sessionId,
      count,
      totalBytes,
      deliveryMethod,
      expiresAt: confirmation.expiresAt.toISOString()
    };
  } catch (error) {
    logger.error({ error: error.message }, "Failed to create confirmation session in requestZipConfirmation");
    return {
      requiresConfirmation: true,
      estimatedSizeMB,
      deliveryMethod,
      error: error.message
    };
  }
}

