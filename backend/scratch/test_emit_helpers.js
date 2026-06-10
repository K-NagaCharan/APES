import * as helpers from "../src/socket/events.js";
import { SOCKET_EVENTS } from "../../shared/socketEvents.js";

// Helper assertions
const assert = (condition, message) => {
  if (!condition) {
    console.error(`Assertion Failed: ${message}`);
    process.exit(1);
  }
};

console.log("Starting verification of backend Socket.io emit helpers...");

// Test Case 1: Verification with valid io instance
let lastRoom = null;
let lastEvent = null;
let lastPayload = null;

const mockIO = {
  to(room) {
    lastRoom = room;
    return {
      emit(event, payload) {
        lastEvent = event;
        lastPayload = payload;
      }
    };
  }
};

const testUserId = "user_123456";
const testPayload = { status: "test", details: "hello" };

// 1. emitRecognitionProgress
helpers.emitRecognitionProgress(mockIO, testUserId, testPayload);
assert(lastRoom === testUserId, `Expected room to be ${testUserId}, got ${lastRoom}`);
assert(lastEvent === SOCKET_EVENTS.RECOGNITION_PROGRESS, `Expected event to be recognition:progress, got ${lastEvent}`);
assert(lastPayload === testPayload, "Payload mismatch");

// 2. emitFaceNew
helpers.emitFaceNew(mockIO, testUserId, testPayload);
assert(lastRoom === testUserId, `Expected room to be ${testUserId}, got ${lastRoom}`);
assert(lastEvent === SOCKET_EVENTS.FACE_NEW, `Expected event to be face:new, got ${lastEvent}`);
assert(lastPayload === testPayload, "Payload mismatch");

// 3. emitRecognitionDone
helpers.emitRecognitionDone(mockIO, testUserId, testPayload);
assert(lastRoom === testUserId, `Expected room to be ${testUserId}, got ${lastRoom}`);
assert(lastEvent === SOCKET_EVENTS.RECOGNITION_DONE, `Expected event to be recognition:done, got ${lastEvent}`);
assert(lastPayload === testPayload, "Payload mismatch");

// 4. emitDeliveryDone
helpers.emitDeliveryDone(mockIO, testUserId, testPayload);
assert(lastRoom === testUserId, `Expected room to be ${testUserId}, got ${lastRoom}`);
assert(lastEvent === SOCKET_EVENTS.DELIVERY_DONE, `Expected event to be delivery:done, got ${lastEvent}`);
assert(lastPayload === testPayload, "Payload mismatch");

// 5. emitDeliveryFailed
helpers.emitDeliveryFailed(mockIO, testUserId, testPayload);
assert(lastRoom === testUserId, `Expected room to be ${testUserId}, got ${lastRoom}`);
assert(lastEvent === SOCKET_EVENTS.DELIVERY_FAILED, `Expected event to be delivery:failed, got ${lastEvent}`);
assert(lastPayload === testPayload, "Payload mismatch");

// 6. emitDeliveryZipConfirm
helpers.emitDeliveryZipConfirm(mockIO, testUserId, testPayload);
assert(lastRoom === testUserId, `Expected room to be ${testUserId}, got ${lastRoom}`);
assert(lastEvent === SOCKET_EVENTS.DELIVERY_ZIP_CONFIRM, `Expected event to be delivery:zip-confirm, got ${lastEvent}`);
assert(lastPayload === testPayload, "Payload mismatch");

console.log("Success: All helpers emitted correct events to correct rooms!");

// Test Case 2: Guard check when io is null or undefined
try {
  helpers.emitRecognitionProgress(null, testUserId, testPayload);
  helpers.emitFaceNew(undefined, testUserId, testPayload);
  helpers.emitRecognitionDone(null, testUserId, testPayload);
  helpers.emitDeliveryDone(undefined, testUserId, testPayload);
  helpers.emitDeliveryFailed(null, testUserId, testPayload);
  helpers.emitDeliveryZipConfirm(undefined, testUserId, testPayload);
  console.log("Success: Guard checks successfully handled null/undefined io instances without throwing!");
} catch (error) {
  console.error("Failure: Exception thrown when executing with null/undefined io", error);
  process.exit(1);
}

console.log("All unit tests passed successfully!");
