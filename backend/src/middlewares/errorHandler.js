import { logger } from "../config/logger.js";
import { errorResponse } from "../utils/apiResponse.js";
import { env } from "../config/env.js";

export const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  logger.error({
    requestId: req.id,
    path: req.path,
    method: req.method,
    status,
    message,
    stack: env.NODE_ENV === "development" ? err.stack : undefined
  });

  return errorResponse(res, status, message);
};
