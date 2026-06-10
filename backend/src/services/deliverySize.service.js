import Photo from "../models/Photo.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import mongoose from "mongoose";
import fs from "fs";
import { fileURLToPath } from "url";

// Custom error class for delivery size failures
export class DeliverySizeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "DeliverySizeError";
    this.details = details;
  }
}

/**
 * Checks the total size of photos requested for delivery.
 * Determines if it exceeds the platforms threshold.
 * 
 * @param {object} params
 * @param {string[]|ObjectId[]} params.photoIds - Array of photo IDs to check.
 * @returns {Promise<object>} Size metadata and threshold flag.
 */
export async function checkDeliverySize({ photoIds }) {
  if (!photoIds || !Array.isArray(photoIds)) {
    throw new DeliverySizeError("photoIds must be a valid array");
  }

  const count = photoIds.length;
  if (count === 0) {
    return {
      totalBytes: 0,
      count: 0,
      exceedsThreshold: false
    };
  }

  // Validate ObjectId formats before querying
  const invalidIds = photoIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    throw new DeliverySizeError("Invalid photo ID format detected", { invalidIds });
  }

  // Fetch bytes, width, height, and url from the database for calculation fallbacks
  let photos;
  try {
    photos = await Photo.find({ _id: { $in: photoIds } }).select("bytes width height url").lean();
  } catch (err) {
    logger.error({ err: err.message }, "Error fetching photo bytes metadata from DB");
    throw new DeliverySizeError(`Failed to retrieve photos: ${err.message}`, { originalError: err });
  }

  // Check if all requested IDs were found in DB
  const foundIds = new Set(photos.map(p => p._id.toString()));
  const missingIds = photoIds.filter(id => !foundIds.has(id.toString()));
  if (missingIds.length > 0) {
    throw new DeliverySizeError("Some requested photos were not found", { missingIds });
  }

  // Map photos, dynamically resolving bytes with disk size, dimension estimation, or fallback
  const processedPhotos = photos.map(p => {
    let photoBytes = p.bytes;

    // 1. Try actual file size from disk if available
    if (photoBytes === undefined || photoBytes === null || typeof photoBytes !== "number" || isNaN(photoBytes)) {
      try {
        let localPath = null;
        if (p.url && p.url.startsWith("file://")) {
          localPath = fileURLToPath(p.url);
        } else if (p.url && (p.url.startsWith("/") || /^[a-zA-Z]:\\/.test(p.url) || /^[a-zA-Z]:\//.test(p.url))) {
          localPath = p.url;
        }
        if (localPath && fs.existsSync(localPath)) {
          const stats = fs.statSync(localPath);
          if (stats.isFile()) {
            photoBytes = stats.size;
          }
        }
      } catch (err) {
        // Ignore and proceed to fallback
      }
    }

    // 2. Otherwise use photo.bytes if valid
    if (photoBytes !== undefined && photoBytes !== null && typeof photoBytes === "number" && !isNaN(photoBytes)) {
      return { ...p, bytes: photoBytes };
    }

    // 3. Otherwise estimate from dimensions: ~0.25 bytes per pixel
    if (p.width && p.height && typeof p.width === "number" && typeof p.height === "number") {
      photoBytes = Math.round(p.width * p.height * 0.25);
    } else {
      // 4. Fallback to 1MB
      photoBytes = 1048576;
    }

    return { ...p, bytes: photoBytes };
  });

  // Compute total bytes
  const totalBytes = processedPhotos.reduce((sum, p) => sum + p.bytes, 0);

  // Compare against threshold
  const threshold = env.DELIVERY_SIZE_THRESHOLD_BYTES;
  const exceedsThreshold = totalBytes > threshold;

  logger.info({
    photoCount: count,
    totalBytes,
    zipThresholdBytes: threshold,
    exceedsThreshold
  }, "Delivery size check details");

  return {
    totalBytes,
    count,
    exceedsThreshold
  };
}

