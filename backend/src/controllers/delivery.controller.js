import DeliveryHistory from "../models/DeliveryHistory.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { logger } from "../config/logger.js";

/**
 * Handles GET /api/v1/delivery/history
 * Retrieves paginated, filtered delivery history records for the authenticated user.
 */
export async function getDeliveryHistoryHandler(req, res) {
  const { page = "1", limit = "10", medium, format, status } = req.query;

  // Validate pagination parameters
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum <= 0) {
    return errorResponse(res, 400, "Invalid page parameter. Must be a positive integer.");
  }
  if (isNaN(limitNum) || limitNum <= 0) {
    return errorResponse(res, 400, "Invalid limit parameter. Must be a positive integer.");
  }

  // Validate filters
  if (medium && !["email", "whatsapp"].includes(medium)) {
    return errorResponse(res, 400, "Invalid medium filter. Must be 'email' or 'whatsapp'.");
  }
  if (format && !["links", "zip"].includes(format)) {
    return errorResponse(res, 400, "Invalid format filter. Must be 'links' or 'zip'.");
  }
  if (status && !["queued", "delivered", "failed"].includes(status)) {
    return errorResponse(res, 400, "Invalid status filter. Must be 'queued', 'delivered', or 'failed'.");
  }

  const userId = req.user._id;

  // Build query
  const query = { userId };
  if (medium) query.medium = medium;
  if (format) query.format = format;
  if (status) query.status = status;

  try {
    const skip = (pageNum - 1) * limitNum;
    const total = await DeliveryHistory.countDocuments(query);
    const records = await DeliveryHistory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const results = records.map((r) => ({
      _id: r._id,
      recipient: r.recipient,
      medium: r.medium,
      format: r.format || "links",
      count: r.count || r.photoIds?.length || 0,
      status: r.status,
      createdAt: r.createdAt,
      deliveredAt: r.deliveredAt || null,
      zipDeletedAt: r.zipDeletedAt || null,
      zipUrl: r.zipUrl || null
    }));

    return successResponse(
      res,
      {
        records: results,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      },
      "Delivery history retrieved successfully."
    );
  } catch (error) {
    logger.error({ error: error.message, userId }, "Failed to retrieve delivery history");
    return errorResponse(res, 500, "Failed to retrieve delivery history.");
  }
}
