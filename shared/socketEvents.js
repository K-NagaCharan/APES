/**
 * Socket.io Event Names Contract
 *
 * Namespace Conventions:
 * - recognition:* : Events related to photo face recognition progress and results.
 * - face:*        : Events related to new face registrations/detections.
 * - delivery:*    : Events related to ZIP generation and delivery status.
 */
export const SOCKET_EVENTS = {
  RECOGNITION_PROGRESS: "recognition:progress",
  FACE_NEW: "face:new",
  RECOGNITION_DONE: "recognition:done",
  DELIVERY_DONE: "delivery:done",
  DELIVERY_FAILED: "delivery:failed",
  DELIVERY_ZIP_CONFIRM: "delivery:zip-confirm"
};
