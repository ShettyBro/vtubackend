import logger from "../config/logger.js";

export default function errorHandler(err, req, res, next) {
  logger.error("Unhandled error", {
    requestId: req.requestId,
    path: req.originalUrl,
    error: err.message
  });

  res.status(500).json({
    success: false,
    errorCode: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong",
    requestId: req.requestId
  });
}
