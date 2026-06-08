import mongoose from "mongoose";
import { errorResponse } from "../utils/apiResponse.js";

/**
 * Validator middleware checking if route parameters match Mongoose ObjectIDs
 */
export const validatePhotoId = (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, 400, "Invalid photo ID format");
  }

  next();
};
