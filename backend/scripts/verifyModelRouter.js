import { selectModel } from "../src/services/modelRouter.js";
import { MODELS } from "../src/config/models.js";
import { logger } from "../src/config/logger.js";

const assert = (condition, message) => {
  if (!condition) {
    logger.error(`[Assertion Failed] ${message}`);
    throw new Error(message);
  }
  logger.info(`[Assertion Passed] ${message}`);
};

const runVerification = async () => {
  logger.info("Starting model router verification tests...");

  const testCases = [
    // FAST test cases
    { input: "Show my photos", expected: MODELS.FAST },
    { input: "Show photos of Dad and Mom", expected: MODELS.FAST },
    { input: "Show photos after 2023", expected: MODELS.FAST },
    { input: "", expected: MODELS.FAST },
    { input: "     ", expected: MODELS.FAST },
    { input: null, expected: MODELS.FAST },
    { input: undefined, expected: MODELS.FAST },
    { input: 12345, expected: MODELS.FAST },
    { input: {}, expected: MODELS.FAST },

    // REASONING test cases
    { input: "Share these on WhatsApp", expected: MODELS.REASONING },
    { input: "Show my photos and email them", expected: MODELS.REASONING },
    { input: "Find Dad's birthday pictures and send them to Mom on WhatsApp", expected: MODELS.REASONING },
    { input: "compress all files", expected: MODELS.REASONING },
    { input: "first find photos then mail them", expected: MODELS.REASONING },
    { input: "archive this session", expected: MODELS.REASONING },
    { input: "zip the photos", expected: MODELS.REASONING },
  ];

  for (const { input, expected } of testCases) {
    const inputDesc = typeof input === "string" ? `"${input}"` : String(input);
    logger.info(`Testing input: ${inputDesc}`);
    const actual = selectModel(input);
    assert(actual === expected, `Expected selectModel(${inputDesc}) to be "${expected}", got "${actual}"`);
  }

  logger.info("ALL MODEL ROUTER VERIFICATION TESTS COMPLETED SUCCESSFULLY!");
};

runVerification().catch((err) => {
  logger.fatal(`Verification failed: ${err.message}`);
  process.exit(1);
});
