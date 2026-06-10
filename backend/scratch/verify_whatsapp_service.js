import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import {
  initializeWhatsApp,
  sendWhatsApp,
  shutdownWhatsApp,
  isWhatsAppReady
} from "../src/services/whatsapp.service.js";
import { logger } from "../src/config/logger.js";

const assert = (condition, message) => {
  if (!condition) {
    logger.error(`Assertion Failed: ${message}`);
    process.exit(1);
  }
};

const waitForReady = (client, timeoutMs) => {
  return new Promise((resolve, reject) => {
    // Check if already ready
    isWhatsAppReady().then((ready) => {
      if (ready) {
        return resolve();
      }
    });

    const onReady = () => {
      client.off("ready", onReady);
      resolve();
    };

    client.on("ready", onReady);

    setTimeout(() => {
      client.off("ready", onReady);
      reject(new Error(`Timeout waiting for client to reach ready state within ${timeoutMs}ms`));
    }, timeoutMs);
  });
};

async function runTests() {
  logger.info("Initializing DB connection...");
  await connectDB();

  // Test target phone number
  const testRecipient = process.env.TEST_WHATSAPP_RECIPIENT || "919999999999";
  const dummyPhotos = [
    { url: "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1/test_portrait.png" }
  ];

  logger.info("--- Phase 1: Initialize WhatsApp & Scan QR if needed ---");
  const clientInstance = initializeWhatsApp();

  logger.info("Waiting for client to be ready (up to 5 minutes to allow time for scanning QR code)...");
  await waitForReady(clientInstance, 300000);
  logger.info("WhatsApp client is READY.");

  logger.info("--- Phase 2: Send Test WhatsApp Message ---");
  try {
    const deliveryMeta = await sendWhatsApp({
      recipient: testRecipient,
      photos: dummyPhotos
    });
    logger.info({ deliveryMeta }, "Delivery succeeded!");
    assert(deliveryMeta.recipient === testRecipient, "Recipient mismatch");
    assert(deliveryMeta.messageId !== undefined, "Missing message ID");
  } catch (err) {
    logger.error({ err: err.message }, "WhatsApp sending failed (this is expected if the phone number is invalid or unregistered, but the client must have been ready)");
  }

  logger.info("--- Phase 3: Shutdown Client ---");
  await shutdownWhatsApp();
  const readyAfterShutdown = await isWhatsAppReady();
  assert(readyAfterShutdown === false, "Client should not be ready after shutdown");
  logger.info("Shutdown successful.");

  logger.info("--- Phase 4: Restart & Assert Auto-Ready Session Persistence ---");
  const restartedClient = initializeWhatsApp();
  logger.info("Waiting for client to automatically reach ready state using persisted session (timeout: 25 seconds)...");
  try {
    await waitForReady(restartedClient, 25000);
    logger.info("SUCCESS: WhatsApp client automatically authenticated and reached ready state using local session!");
  } catch (err) {
    logger.error({ err: err.message }, "FAILED: Restart did not automatically reach ready state. Session persistence might be failing.");
    await shutdownWhatsApp();
    process.exit(1);
  }

  // Final cleanup
  await shutdownWhatsApp();
  await mongoose.disconnect();
  logger.info("All WhatsApp service verification tests completed successfully!");
  process.exit(0);
}

runTests().catch(async (err) => {
  logger.error({ err: err.message || err }, "Verification script failed");
  await shutdownWhatsApp();
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
