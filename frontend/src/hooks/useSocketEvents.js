import { useEffect, useRef } from "react";
import { SOCKET_EVENTS } from "../../../shared/socketEvents.js";

/**
 * React hook to register Socket.io event listeners.
 * Emits logs to console and triggers optional callback handlers.
 * Utilizes useRef to prevent duplicate listener registrations across re-renders.
 *
 * @param {object} socket - Socket.io Client instance
 * @param {object} handlers - Event handlers callback mapping
 * @param {function} [handlers.onRecognitionProgress] - Callback for recognition:progress
 * @param {function} [handlers.onFaceNew] - Callback for face:new
 * @param {function} [handlers.onRecognitionDone] - Callback for recognition:done
 * @param {function} [handlers.onDeliveryDone] - Callback for delivery:done
 * @param {function} [handlers.onDeliveryFailed] - Callback for delivery:failed
 */
export const useSocketEvents = (socket, handlers = {}) => {
  const handlersRef = useRef(handlers);

  // Keep the handlers reference up to date on every render
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!socket) return;

    const handleProgress = (payload) => {
      console.log("[SocketEvent] recognition:progress", payload);
      if (handlersRef.current.onRecognitionProgress) {
        handlersRef.current.onRecognitionProgress(payload);
      }
    };

    const handleFaceNew = (payload) => {
      console.log("[SocketEvent] face:new", payload);
      if (handlersRef.current.onFaceNew) {
        handlersRef.current.onFaceNew(payload);
      }
    };

    const handleDone = (payload) => {
      console.log("[SocketEvent] recognition:done", payload);
      if (handlersRef.current.onRecognitionDone) {
        handlersRef.current.onRecognitionDone(payload);
      }
    };

    const handleDeliveryDone = (payload) => {
      console.log("[SocketEvent] delivery:done", payload);
      if (handlersRef.current.onDeliveryDone) {
        handlersRef.current.onDeliveryDone(payload);
      }
    };

    const handleDeliveryFailed = (payload) => {
      console.log("[SocketEvent] delivery:failed", payload);
      if (handlersRef.current.onDeliveryFailed) {
        handlersRef.current.onDeliveryFailed(payload);
      }
    };

    // Register event listeners
    socket.on(SOCKET_EVENTS.RECOGNITION_PROGRESS, handleProgress);
    socket.on(SOCKET_EVENTS.FACE_NEW, handleFaceNew);
    socket.on(SOCKET_EVENTS.RECOGNITION_DONE, handleDone);
    socket.on(SOCKET_EVENTS.DELIVERY_DONE, handleDeliveryDone);
    socket.on(SOCKET_EVENTS.DELIVERY_FAILED, handleDeliveryFailed);

    // Clean up event listeners on unmount or when socket instance changes
    return () => {
      socket.off(SOCKET_EVENTS.RECOGNITION_PROGRESS, handleProgress);
      socket.off(SOCKET_EVENTS.FACE_NEW, handleFaceNew);
      socket.off(SOCKET_EVENTS.RECOGNITION_DONE, handleDone);
      socket.off(SOCKET_EVENTS.DELIVERY_DONE, handleDeliveryDone);
      socket.off(SOCKET_EVENTS.DELIVERY_FAILED, handleDeliveryFailed);
    };
  }, [socket]);
};
