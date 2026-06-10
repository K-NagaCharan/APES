import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { runAgent } from "../src/agent/agentLoop.js";
import { clearSession } from "../src/services/session.service.js";
import { logger } from "../src/config/logger.js";

async function testJan() {
  await connectDB();
  const userId = "6a268c108425277e3ddee488";
  
  // Clear any existing session to start fresh
  await clearSession(userId);
  
  logger.info("Running agent with: 'show me jan's photos'");
  try {
    const result = await runAgent({
      userId,
      message: "show me jan's photos"
    });
    logger.info({ result }, "Agent result for 'show me jan's photos'");
  } catch (err) {
    logger.error(err, "Error running agent for Jan");
  }

  // Clear session again
  await clearSession(userId);

  logger.info("Running agent with: 'show mw photos of charan'");
  try {
    const result = await runAgent({
      userId,
      message: "show mw photos of charan"
    });
    logger.info({ result }, "Agent result for 'show mw photos of charan'");
  } catch (err) {
    logger.error(err, "Error running agent for Charan");
  }

  await mongoose.disconnect();
  process.exit(0);
}

testJan().catch(err => {
  console.error(err);
  process.exit(1);
});
