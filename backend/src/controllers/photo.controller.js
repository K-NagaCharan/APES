import * as photoService from "../services/photo.service.js";
import Photo from "../models/Photo.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../config/logger.js";

/**
 * Handle photo upload requests
 */
export const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    return errorResponse(res, 400, "No file uploaded");
  }

  logger.info({ requestId: req.id, userId: req.user._id }, "Uploading buffer stream to Cloudinary");

  // Call Cloudinary stream upload
  const uploadResult = await photoService.uploadStream(req.file.buffer);

  // Persist image metadata
  const photo = new Photo({
    userId: req.user._id,
    url: uploadResult.secure_url,
    cloudinaryPublicId: uploadResult.public_id,
    width: uploadResult.width,
    height: uploadResult.height,
    status: "completed"
  });

  await photo.save();

  logger.info({ requestId: req.id, photoId: photo._id }, "Photo registered in MongoDB");

  return res.status(201).json({
    success: true,
    message: "Photo uploaded successfully",
    data: {
      photo: {
        id: photo._id,
        userId: photo.userId,
        url: photo.url,
        cloudinaryPublicId: photo.cloudinaryPublicId,
        width: photo.width,
        height: photo.height,
        status: photo.status,
        faceCount: photo.faceCount,
        uploadDate: photo.uploadDate
      }
    }
  });
});

/**
 * Handle listing photos for the authenticated user
 */
export const getPhotos = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit || "30", 10);
  const skip = parseInt(req.query.skip || "0", 10);

  // Retrieve user's photos, sorted newest first
  const photos = await Photo.find({ userId: req.user._id })
    .sort({ uploadDate: -1 })
    .skip(skip)
    .limit(limit);

  const formattedPhotos = photos.map((photo) => ({
    id: photo._id,
    userId: photo.userId,
    url: photo.url,
    cloudinaryPublicId: photo.cloudinaryPublicId,
    width: photo.width,
    height: photo.height,
    status: photo.status,
    faceCount: photo.faceCount,
    uploadDate: photo.uploadDate
  }));

  return successResponse(res, { photos: formattedPhotos }, "Photos retrieved successfully");
});

/**
 * Handle photo deletions
 */
export const deletePhoto = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const photo = await Photo.findById(id);
  if (!photo) {
    return errorResponse(res, 404, "Photo not found");
  }

  // Enforce ownership: 403 Forbidden on mismatch
  if (photo.userId.toString() !== req.user._id.toString()) {
    return errorResponse(res, 403, "Access denied. You do not own this photo.");
  }

  logger.info(
    { requestId: req.id, photoId: photo._id, publicId: photo.cloudinaryPublicId },
    "Destroying asset on Cloudinary"
  );

  // Remove from Cloudinary
  await photoService.deleteAsset(photo.cloudinaryPublicId);

  // Remove metadata record
  await Photo.deleteOne({ _id: id });

  logger.info({ requestId: req.id, photoId: photo._id }, "Photo successfully deleted from database");

  return successResponse(res, null, "Photo deleted successfully");
});
