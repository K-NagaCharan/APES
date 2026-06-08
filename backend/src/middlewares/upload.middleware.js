import multer from "multer";
import { errorResponse } from "../utils/apiResponse.js";

const storage = multer.memoryStorage();

// Accept JPEG, PNG, and WEBP only
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  const allowedExtensions = /\.(jpg|jpeg|png|webp)$/i;

  if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.test(file.originalname)) {
    return cb(new Error("Invalid file type. Only JPEG, PNG, and WEBP images are allowed."), false);
  }
  cb(null, true);
};

// Limit uploads to 10MB
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter
}).single("file");

/**
 * Middleware wrapper to intercept file upload parameters and handle Multer errors gracefully
 */
export const uploadSingle = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return errorResponse(res, 400, "File size limit exceeded. Maximum size is 10MB.");
        }
        return errorResponse(res, 400, `Upload configuration error: ${err.message}`);
      }
      return errorResponse(res, 400, err.message);
    }
    next();
  });
};
