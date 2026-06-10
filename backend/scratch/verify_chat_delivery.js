import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import redis from "../src/config/redis.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";
import { logger } from "../src/config/logger.js";
import Photo from "../src/models/Photo.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";
import { executeTool } from "../src/agent/toolExecutor.js";
import { updateAgentMemory } from "../src/agent/memoryManager.js";
import { getSession, saveSession, clearSession } from "../src/services/session.service.js";

async function runTests() {
  logger.info("Initializing DB and Redis connections...");
  await connectDB();

  const testUserId = new mongoose.Types.ObjectId().toString();
  logger.info({ testUserId }, "Using test userId");

  // Create mock photos in DB for testing
  const mockPhoto1 = await Photo.create({
    userId: testUserId,
    url: "http://example.com/photo1.jpg",
    cloudinaryPublicId: "photo1",
    status: "completed",
    uploadDate: new Date()
  });

  const mockPhoto2 = await Photo.create({
    userId: testUserId,
    url: "http://example.com/photo2.jpg",
    cloudinaryPublicId: "photo2",
    status: "completed",
    uploadDate: new Date()
  });

  const photoIds = [mockPhoto1._id.toString(), mockPhoto2._id.toString()];
  logger.info({ photoIds }, "Created mock photos in DB");

  try {
    // ----------------------------------------------------
    // Scenario 4: No previous search (returns clean error)
    // ----------------------------------------------------
    logger.info("--- Scenario 4: No previous search (returns clean error) ---");
    await clearSession(testUserId);
    const sessionNoSearch = await getSession(testUserId);

    const resultNoSearch = await executeTool(
      "sendEmail",
      { email: "test@example.com" },
      testUserId,
      sessionNoSearch
    );

    logger.info({ resultNoSearch }, "Result for Scenario 4");
    if (resultNoSearch.success !== false || !resultNoSearch.error.includes("No recent photo search found")) {
      throw new Error(`Scenario 4 Failed: Expected clean reference error, got ${JSON.stringify(resultNoSearch)}`);
    }
    logger.info("Scenario 4 PASSED.");

    // ----------------------------------------------------
    // Scenario 1: Search -> Email these photos
    // ----------------------------------------------------
    logger.info("--- Scenario 1: Search -> Email these photos ---");
    
    // Simulate searchPhotos output
    const searchResult = [
      { id: photoIds[0], url: "http://example.com/photo1.jpg" },
      { id: photoIds[1], url: "http://example.com/photo2.jpg" }
    ];

    // Update memory
    await updateAgentMemory({
      userId: testUserId,
      toolName: "searchPhotos",
      toolArgs: { people: ["John"] },
      toolResult: searchResult
    });

    const sessionWithSearch = await getSession(testUserId);
    logger.info({ lastPhotoSearch: sessionWithSearch.memory.lastPhotoSearch }, "Session after searchPhotos");

    // Verify metadata structure
    const searchMem = sessionWithSearch.memory.lastPhotoSearch;
    if (searchMem.query !== "people: [John]" || !searchMem.timestamp || !Array.isArray(searchMem.photoIds) || searchMem.photoIds.length !== 2) {
      throw new Error(`Scenario 1 Failed: Memory metadata incomplete: ${JSON.stringify(searchMem)}`);
    }

    const resultEmail = await executeTool(
      "sendEmail",
      { email: "test@example.com" },
      testUserId,
      sessionWithSearch
    );

    logger.info({ resultEmail }, "Result for Scenario 1");
    if (!resultEmail.success || !resultEmail.message.includes("Email delivery queued successfully")) {
      throw new Error(`Scenario 1 Failed: Expected successful queuing, got ${JSON.stringify(resultEmail)}`);
    }

    // Verify DeliveryHistory record
    const deliveryRecord = await DeliveryHistory.findOne({ userId: testUserId, medium: "email" });
    if (!deliveryRecord || deliveryRecord.photoIds.length !== 2) {
      throw new Error(`Scenario 1 Failed: DeliveryHistory record incorrect or missing`);
    }
    logger.info("Scenario 1 PASSED.");

    // ----------------------------------------------------
    // Scenario 2: Search -> WhatsApp these photos
    // ----------------------------------------------------
    logger.info("--- Scenario 2: Search -> WhatsApp these photos ---");
    
    const resultWhatsApp = await executeTool(
      "sendWhatsApp",
      { phoneNumber: "+1234567890" },
      testUserId,
      sessionWithSearch
    );

    logger.info({ resultWhatsApp }, "Result for Scenario 2");
    if (!resultWhatsApp.success || !resultWhatsApp.message.includes("WhatsApp delivery queued successfully")) {
      throw new Error(`Scenario 2 Failed: Expected successful queuing, got ${JSON.stringify(resultWhatsApp)}`);
    }

    const waRecord = await DeliveryHistory.findOne({ userId: testUserId, medium: "whatsapp" });
    if (!waRecord || waRecord.photoIds.length !== 2) {
      throw new Error(`Scenario 2 Failed: DeliveryHistory WhatsApp record incorrect or missing`);
    }
    logger.info("Scenario 2 PASSED.");

    // ----------------------------------------------------
    // Scenario 3: Multiple searches -> "Email these" uses latest search
    // ----------------------------------------------------
    logger.info("--- Scenario 3: Multiple searches -> 'Email these' uses latest search ---");
    
    // First search: John's photos
    await updateAgentMemory({
      userId: testUserId,
      toolName: "searchPhotos",
      toolArgs: { people: ["John"] },
      toolResult: [{ id: photoIds[0], url: "http://example.com/photo1.jpg" }]
    });

    // Second search: Cats photos
    await updateAgentMemory({
      userId: testUserId,
      toolName: "searchPhotos",
      toolArgs: { event: "cats playing" },
      toolResult: [{ id: photoIds[1], url: "http://example.com/photo2.jpg" }]
    });

    const sessionMultiSearch = await getSession(testUserId);
    logger.info({ query: sessionMultiSearch.memory.lastPhotoSearch.query }, "Latest search query in memory");
    if (sessionMultiSearch.memory.lastPhotoSearch.query !== "event: cats playing") {
      throw new Error("Scenario 3 Failed: Search query in memory is not the latest one");
    }

    const resultMultiSearch = await executeTool(
      "sendEmail",
      { email: "latest@example.com" },
      testUserId,
      sessionMultiSearch
    );

    logger.info({ resultMultiSearch }, "Result for Scenario 3");
    
    // Check DeliveryHistory for this recipient
    const latestRecord = await DeliveryHistory.findOne({ recipient: "latest@example.com" });
    if (!latestRecord || latestRecord.photoIds.length !== 1 || latestRecord.photoIds[0].toString() !== photoIds[1]) {
      throw new Error(`Scenario 3 Failed: Delivery record does not reference the latest search photo ID`);
    }
    logger.info("Scenario 3 PASSED.");

    // ----------------------------------------------------
    // Scenario 5: Repeated send requests (continue to work)
    // ----------------------------------------------------
    logger.info("--- Scenario 5: Repeated send requests (continue to work) ---");

    const resultRepeat1 = await executeTool(
      "sendEmail",
      { email: "repeat1@example.com" },
      testUserId,
      sessionMultiSearch
    );
    const resultRepeat2 = await executeTool(
      "sendEmail",
      { email: "repeat2@example.com" },
      testUserId,
      sessionMultiSearch
    );

    logger.info({ resultRepeat1, resultRepeat2 }, "Results for Scenario 5");
    const rec1 = await DeliveryHistory.findOne({ recipient: "repeat1@example.com" });
    const rec2 = await DeliveryHistory.findOne({ recipient: "repeat2@example.com" });

    if (!rec1 || rec1.photoIds[0].toString() !== photoIds[1] || !rec2 || rec2.photoIds[0].toString() !== photoIds[1]) {
      throw new Error("Scenario 5 Failed: Repeated send requests did not resolve the same photo IDs");
    }
    logger.info("Scenario 5 PASSED.");

    logger.info("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!");
  } finally {
    // Cleanup
    logger.info("Cleaning up mock database records...");
    await Photo.deleteMany({ userId: testUserId });
    await DeliveryHistory.deleteMany({ userId: testUserId });
    await clearSession(testUserId);
    await redis.quit();
    await closeBullMQConnection();
    await mongoose.disconnect();
    logger.info("Clean shutdown complete.");
  }
}

runTests().catch(async (err) => {
  logger.error({ err }, "Test execution failed");
  await redis.quit().catch(() => {});
  await closeBullMQConnection().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
