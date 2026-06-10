import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import redis from "../src/config/redis.js";
import { closeBullMQConnection } from "../src/config/bullmq.js";
import { logger } from "../src/config/logger.js";
import DeliveryHistory from "../src/models/DeliveryHistory.js";
import { getDeliveryHistoryHandler } from "../src/controllers/delivery.controller.js";
import { execute as getDeliveryHistoryTool } from "../src/agent/tools/getDeliveryHistory.js";

const assert = (condition, message) => {
  if (!condition) {
    logger.error(`Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
};

// Mock Express response object creator
const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  return res;
};

async function runTests() {
  logger.info("Initializing DB connection for history verification...");
  await connectDB();

  const testUserId1 = new mongoose.Types.ObjectId();
  const testUserId2 = new mongoose.Types.ObjectId();

  try {
    // ----------------------------------------------------
    // Scenario 1: Setup test data
    // ----------------------------------------------------
    logger.info("Setting up mock delivery records in database...");
    
    // Create 15 records for user 1
    const testRecords = [];
    for (let i = 0; i < 15; i++) {
      testRecords.push({
        userId: testUserId1,
        recipient: `user-${i}@example.com`,
        medium: i % 2 === 0 ? "email" : "whatsapp",
        photoIds: [new mongoose.Types.ObjectId()],
        format: i % 3 === 0 ? "zip" : "links",
        status: i % 5 === 0 ? "failed" : "delivered",
        createdAt: new Date(Date.now() - i * 60000), // separate creation times
        deliveredAt: i % 5 === 0 ? null : new Date(),
        zipUrl: i % 3 === 0 ? `https://cloudinary/zip-${i}.zip` : null
      });
    }

    // Set one ZIP record as cleaned up
    testRecords[3].zipUrl = null;
    testRecords[3].zipDeletedAt = new Date();

    // Create 2 records for user 2 (isolation check)
    const isolationRecords = [
      {
        userId: testUserId2,
        recipient: "other@example.com",
        medium: "email",
        photoIds: [new mongoose.Types.ObjectId()],
        format: "links",
        status: "delivered",
        createdAt: new Date()
      },
      {
        userId: testUserId2,
        recipient: "+1234567890",
        medium: "whatsapp",
        photoIds: [new mongoose.Types.ObjectId()],
        format: "links",
        status: "delivered",
        createdAt: new Date()
      }
    ];

    await DeliveryHistory.create([...testRecords, ...isolationRecords]);
    logger.info("Mock data inserted successfully.");

    // ----------------------------------------------------
    // Scenario 2: Pagination Verification
    // ----------------------------------------------------
    logger.info("--- Scenario 2: Pagination Verification ---");
    
    const reqPagination = {
      query: { page: "2", limit: "5" },
      user: { _id: testUserId1 }
    };
    const resPagination = createMockResponse();

    await getDeliveryHistoryHandler(reqPagination, resPagination);
    assert(resPagination.statusCode === 200, "Should return 200 OK");
    assert(resPagination.body.success === true, "Should succeed");
    assert(resPagination.body.data.records.length === 5, `Expected 5 records, got ${resPagination.body.data.records.length}`);
    assert(resPagination.body.data.pagination.total === 15, `Expected total 15, got ${resPagination.body.data.pagination.total}`);
    assert(resPagination.body.data.pagination.page === 2, "Page metadata mismatch");
    assert(resPagination.body.data.pagination.limit === 5, "Limit metadata mismatch");
    assert(resPagination.body.data.pagination.pages === 3, "Pages metadata mismatch");

    // Check descending order of records (createdAt)
    const records = resPagination.body.data.records;
    for (let i = 0; i < records.length - 1; i++) {
      const time1 = new Date(records[i].createdAt).getTime();
      const time2 = new Date(records[i + 1].createdAt).getTime();
      assert(time1 >= time2, "Records must be sorted by createdAt descending");
    }
    logger.info("Scenario 2 passed.");

    // ----------------------------------------------------
    // Scenario 3: Filtering Verification
    // ----------------------------------------------------
    logger.info("--- Scenario 3: Filtering Verification ---");

    // Filter by medium
    const resFilterMedium = createMockResponse();
    await getDeliveryHistoryHandler({
      query: { page: "1", limit: "20", medium: "email" },
      user: { _id: testUserId1 }
    }, resFilterMedium);
    assert(resFilterMedium.body.data.records.every(r => r.medium === "email"), "All records should have medium 'email'");

    // Filter by format
    const resFilterFormat = createMockResponse();
    await getDeliveryHistoryHandler({
      query: { page: "1", limit: "20", format: "zip" },
      user: { _id: testUserId1 }
    }, resFilterFormat);
    assert(resFilterFormat.body.data.records.every(r => r.format === "zip"), "All records should have format 'zip'");

    // Filter by status
    const resFilterStatus = createMockResponse();
    await getDeliveryHistoryHandler({
      query: { page: "1", limit: "20", status: "failed" },
      user: { _id: testUserId1 }
    }, resFilterStatus);
    assert(resFilterStatus.body.data.records.every(r => r.status === "failed"), "All records should have status 'failed'");
    logger.info("Scenario 3 passed.");

    // ----------------------------------------------------
    // Scenario 4: Authenticated User Isolation
    // ----------------------------------------------------
    logger.info("--- Scenario 4: Authenticated User Isolation ---");
    
    const resIsolation = createMockResponse();
    await getDeliveryHistoryHandler({
      query: { page: "1", limit: "10" },
      user: { _id: testUserId2 }
    }, resIsolation);
    assert(resIsolation.body.data.records.length === 2, `Expected 2 records for user 2, got ${resIsolation.body.data.records.length}`);
    assert(resIsolation.body.data.records.every(r => r.recipient === "other@example.com" || r.recipient === "+1234567890"), "Should only return records owned by user 2");
    logger.info("Scenario 4 passed.");

    // ----------------------------------------------------
    // Scenario 5: Cleaned-up ZIP Records
    // ----------------------------------------------------
    logger.info("--- Scenario 5: Cleaned-up ZIP Records ---");
    
    const resCleanedZip = createMockResponse();
    await getDeliveryHistoryHandler({
      query: { page: "1", limit: "20" },
      user: { _id: testUserId1 }
    }, resCleanedZip);

    // Find the cleaned-up ZIP record (index 3 in test records setup)
    const cleanedRecord = resCleanedZip.body.data.records.find(r => r.recipient === "user-3@example.com");
    assert(cleanedRecord, "Should find the specific user-3 record");
    assert(cleanedRecord.format === "zip", "Should be format: zip");
    assert(cleanedRecord.zipUrl === null, "zipUrl must be null for cleaned up ZIPs");
    assert(cleanedRecord.zipDeletedAt !== null, "zipDeletedAt must not be null");
    logger.info("Scenario 5 passed.");

    // ----------------------------------------------------
    // Scenario 6: AI Tool Retrieval
    // ----------------------------------------------------
    logger.info("--- Scenario 6: AI Tool Retrieval ---");
    
    const aiResult = await getDeliveryHistoryTool({ limit: 5 }, testUserId1.toString());
    assert(Array.isArray(aiResult), "AI tool should return an array");
    assert(aiResult.length === 5, `Expected 5 items, got ${aiResult.length}`);
    assert(aiResult[0].id && aiResult[0].recipient && aiResult[0].medium && aiResult[0].format, "Missing core fields in AI tool output");
    logger.info("Scenario 6 passed.");

    // ----------------------------------------------------
    // Scenario 7: Empty History
    // ----------------------------------------------------
    logger.info("--- Scenario 7: Empty History ---");
    
    const randomUserId = new mongoose.Types.ObjectId();
    const resEmpty = createMockResponse();
    await getDeliveryHistoryHandler({
      query: { page: "1", limit: "10" },
      user: { _id: randomUserId }
    }, resEmpty);
    assert(resEmpty.statusCode === 200, "Should succeed with 200 OK");
    assert(resEmpty.body.data.records.length === 0, "Should return empty records array");
    assert(resEmpty.body.data.pagination.total === 0, "Should report total count as 0");
    logger.info("Scenario 7 passed.");

    // ----------------------------------------------------
    // Scenario 8: Invalid Pagination Parameters
    // ----------------------------------------------------
    logger.info("--- Scenario 8: Invalid Pagination Parameters ---");
    
    const invalidInputs = [
      { page: "-1", limit: "10" },
      { page: "1", limit: "-5" },
      { page: "abc", limit: "10" },
      { page: "1", limit: "xyz" },
      { page: "0", limit: "10" }
    ];

    for (const input of invalidInputs) {
      const resInvalid = createMockResponse();
      await getDeliveryHistoryHandler({
        query: input,
        user: { _id: testUserId1 }
      }, resInvalid);
      assert(resInvalid.statusCode === 400, `Should fail with 400 Bad Request for query: ${JSON.stringify(input)}, got ${resInvalid.statusCode}`);
      assert(resInvalid.body.success === false, "Success flag must be false");
      assert(resInvalid.body.message.includes("Invalid"), "Error message should report invalid parameters");
    }
    logger.info("Scenario 8 passed.");

    logger.info("ALL DELIVERY HISTORY TESTS PASSED SUCCESSFULLY!");

  } finally {
    logger.info("Cleaning up mock delivery records...");
    await DeliveryHistory.deleteMany({ userId: { $in: [testUserId1, testUserId2] } });
    await redis.quit();
    await closeBullMQConnection();
    await mongoose.disconnect();
    logger.info("Clean shutdown complete.");
  }
}

runTests().catch(async (err) => {
  logger.error({ err: err.message, stack: err.stack }, "History verification script encountered error");
  await redis.quit().catch(() => {});
  await closeBullMQConnection().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
