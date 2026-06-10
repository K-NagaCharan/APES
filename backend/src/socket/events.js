import { SOCKET_EVENTS } from "../../../shared/socketEvents.js";

/**
 * Emit recognition progress update to a specific user
 * @param {object} io - Socket.io Server instance
 * @param {string} userId - Target user ID
 * @param {object} payload - Progress details
 */
export const emitRecognitionProgress = (io, userId, payload) => {
  if (!io) return;
  io.to(userId.toString()).emit(SOCKET_EVENTS.RECOGNITION_PROGRESS, payload);
};

/**
 * Emit face new detection update to a specific user
 * @param {object} io - Socket.io Server instance
 * @param {string} userId - Target user ID
 * @param {object} payload - Face details
 */
export const emitFaceNew = (io, userId, payload) => {
  if (!io) return;
  io.to(userId.toString()).emit(SOCKET_EVENTS.FACE_NEW, payload);
};

/**
 * Emit recognition done event to a specific user
 * @param {object} io - Socket.io Server instance
 * @param {string} userId - Target user ID
 * @param {object} payload - Recognition completion details
 */
export const emitRecognitionDone = (io, userId, payload) => {
  if (!io) return;
  io.to(userId.toString()).emit(SOCKET_EVENTS.RECOGNITION_DONE, payload);
};

/**
 * Emit delivery done event to a specific user
 * @param {object} io - Socket.io Server instance
 * @param {string} userId - Target user ID
 * @param {object} payload - Delivery completion details
 */
export const emitDeliveryDone = (io, userId, payload) => {
  if (!io) return;
  io.to(userId.toString()).emit(SOCKET_EVENTS.DELIVERY_DONE, payload);
};

/**
 * Emit delivery failed event to a specific user
 * @param {object} io - Socket.io Server instance
 * @param {string} userId - Target user ID
 * @param {object} payload - Failure details
 */
export const emitDeliveryFailed = (io, userId, payload) => {
  if (!io) return;
  io.to(userId.toString()).emit(SOCKET_EVENTS.DELIVERY_FAILED, payload);
};

/**
 * Emit delivery started event to a specific user
 * @param {object} io - Socket.io Server instance
 * @param {string} userId - Target user ID
 * @param {object} payload - Started details
 */
export const emitDeliveryStarted = (io, userId, payload) => {
  if (!io) return;
  io.to(userId.toString()).emit(SOCKET_EVENTS.DELIVERY_STARTED, payload);
};

/**
 * Emit delivery zip confirm event to a specific user
 * @param {object} io - Socket.io Server instance
 * @param {string} userId - Target user ID
 * @param {object} payload - ZIP confirmation details
 */
export const emitDeliveryZipConfirm = (io, userId, payload) => {
  if (!io) return;
  io.to(userId.toString()).emit(SOCKET_EVENTS.DELIVERY_ZIP_CONFIRM, payload);
};

