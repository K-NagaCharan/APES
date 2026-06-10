import mongoose from "mongoose";
import DeliveryHistory from "../models/DeliveryHistory.js";
import { logger } from "../config/logger.js";

/**
 * Service to log photo delivery events into the DeliveryHistory collection.
 * 
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.userId - The ID of the user.
 * @param {string} params.medium - The delivery channel ("email" | "whatsapp").
 * @param {string} params.recipient - The recipient's contact details.
 * @param {string[]|mongoose.Types.ObjectId[]} params.photoIds - Array of photo IDs delivered.
 * @param {number} [params.count] - Total number of photos. If omitted, defaults to photoIds.length.
 * @param {string} params.format - Format of delivery ("links" | "zip").
 * @param {string} [params.zipUrl] - Optional Cloudinary URL for zip delivery.
 * @param {string} [params.cloudinaryPublicId] - Optional Cloudinary public ID for zip storage.
 * @returns {Promise<object>} The saved DeliveryHistory document.
 */
export async function logDelivery({
  userId,
  medium,
  recipient,
  photoIds,
  count,
  format,
  zipUrl,
  cloudinaryPublicId
}) {
  // 1. Validation checks
  if (!userId) {
    throw new Error("userId is required");
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid userId format");
  }

  if (!medium) {
    throw new Error("medium is required");
  }
  if (!["email", "whatsapp"].includes(medium)) {
    throw new Error("medium must be 'email' or 'whatsapp'");
  }

  if (!recipient || typeof recipient !== "string" || recipient.trim() === "") {
    throw new Error("recipient is required and must be a non-empty string");
  }

  if (!photoIds || !Array.isArray(photoIds)) {
    throw new Error("photoIds must be an array");
  }
  for (const id of photoIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid photo ID format: ${id}`);
    }
  }

  if (!format) {
    throw new Error("format is required");
  }
  if (!["links", "zip"].includes(format)) {
    throw new Error("format must be 'links' or 'zip'");
  }

  let finalCount = count;
  if (finalCount === undefined || finalCount === null) {
    finalCount = photoIds.length;
  } else {
    if (typeof finalCount !== "number" || finalCount < 0) {
      throw new Error("count must be a non-negative number");
    }
  }

  if (zipUrl !== undefined && zipUrl !== null && typeof zipUrl !== "string") {
    throw new Error("zipUrl must be a string");
  }

  if (cloudinaryPublicId !== undefined && cloudinaryPublicId !== null && typeof cloudinaryPublicId !== "string") {
    throw new Error("cloudinaryPublicId must be a string");
  }

  logger.info({ userId, recipient, medium, count: finalCount, format }, "Logging new delivery event to history");

  const delivery = new DeliveryHistory({
    userId,
    medium,
    recipient: recipient.trim(),
    photoIds,
    count: finalCount,
    format,
    zipUrl: zipUrl || null,
    cloudinaryPublicId: cloudinaryPublicId || null,
    status: "queued"
  });

  await delivery.save();
  return delivery;
}
